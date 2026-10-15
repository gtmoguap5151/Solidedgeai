"""Galinyx OS prototype: stdlib-only durable entity runtime. No external AI or payments."""
import hashlib, json, sqlite3, uuid
from creator import draft_scene
from datetime import datetime, timezone

def now():
    return datetime.now(timezone.utc).isoformat()

class Runtime:
    def __init__(self, database=":memory:"):
        self.db = sqlite3.connect(str(database))
        self.db.execute("PRAGMA foreign_keys=ON")
        self.db.executescript("""
        CREATE TABLE IF NOT EXISTS entities(
            id TEXT PRIMARY KEY, kind TEXT NOT NULL, name TEXT NOT NULL,
            capabilities TEXT NOT NULL, created_at TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS memories(
            entity_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL,
            PRIMARY KEY(entity_id,key),
            FOREIGN KEY(entity_id) REFERENCES entities(id));
        CREATE TABLE IF NOT EXISTS events(
            id INTEGER PRIMARY KEY AUTOINCREMENT, entity_id TEXT NOT NULL,
            event_type TEXT NOT NULL, payload TEXT NOT NULL, created_at TEXT NOT NULL,
            FOREIGN KEY(entity_id) REFERENCES entities(id));
        CREATE TABLE IF NOT EXISTS storyworlds(
            entity_id TEXT NOT NULL, world_key TEXT NOT NULL, canon TEXT NOT NULL,
            PRIMARY KEY(entity_id,world_key),
            FOREIGN KEY(entity_id) REFERENCES entities(id));
        CREATE TABLE IF NOT EXISTS assets(
            entity_id TEXT NOT NULL, asset_id TEXT NOT NULL, data TEXT NOT NULL,
            PRIMARY KEY(entity_id,asset_id),
            FOREIGN KEY(entity_id) REFERENCES entities(id));
        CREATE TABLE IF NOT EXISTS tasks(
            request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL,
            payload_hash TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL,
            FOREIGN KEY(entity_id) REFERENCES entities(id));
        """)
        self.db.commit()
        columns = {row[1] for row in self.db.execute("PRAGMA table_info(tasks)")}
        if "payload_hash" not in columns:
            self.db.close()
            raise RuntimeError("Unsupported database schema: migration required; existing data preserved")

    def create(self, name, kind, capabilities=()):
        if not isinstance(name,str) or not isinstance(kind,str):
            raise ValueError("name and kind must be strings")
        if not name.strip() or not kind.strip() or len(name)>128:
            raise ValueError("name and kind required")
        entity_id = str(uuid.uuid4())
        if kind not in ("creator","researcher"):
            raise ValueError("unsupported entity kind")
        if not isinstance(capabilities,(list,tuple,set)) or any(not isinstance(x,str) for x in capabilities):
            raise ValueError("capabilities must be strings")
        valid = {"memory.write","story.plan","creator.draft","creator.rights","creator.review"}
        if not set(capabilities).issubset(valid):
            raise ValueError("unsupported capability")
        allowed = sorted(set(capabilities))
        with self.db:
            self.db.execute("INSERT INTO entities VALUES (?,?,?,?,?)",
                            (entity_id,kind,name,json.dumps(allowed),now()))
            self._event(entity_id,"entity.created",{"kind":kind,"name":name})
        return entity_id

    def _event(self, entity_id, event_type, payload):
        self.db.execute("INSERT INTO events(entity_id,event_type,payload,created_at) VALUES (?,?,?,?)",
                        (entity_id,event_type,json.dumps(payload,sort_keys=True),now()))

    def entity(self, entity_id):
        row = self.db.execute("SELECT id,kind,name,capabilities FROM entities WHERE id=?",(entity_id,)).fetchone()
        if row is None:
            raise KeyError("Unknown entity")
        return {"id":row[0],"kind":row[1],"name":row[2],"capabilities":json.loads(row[3])}

    def execute(self, entity_id, action, payload=None, request_id=None):
        """Idempotent task execution; denied actions are recorded, never performed."""
        info = self.entity(entity_id)
        if not isinstance(action,str) or not action or len(action)>128:
            raise ValueError("action must be a nonempty string")
        if payload is None:
            payload = {}
        if not isinstance(payload,dict):
            raise ValueError("payload must be an object")
        if request_id is None:
            request_id = str(uuid.uuid4())
        if not isinstance(request_id,str) or not request_id or len(request_id)>128:
            raise ValueError("request_id must be 1-128 characters")
        serialized = json.dumps(payload,sort_keys=True,allow_nan=False,ensure_ascii=False)
        if len(serialized.encode("utf-8")) > 65536:
            raise ValueError("payload exceeds 64 KiB limit")
        payload_hash = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
        previous = self.db.execute("SELECT entity_id,action,payload_hash,result FROM tasks WHERE request_id=?",(request_id,)).fetchone()
        if previous:
            if previous[0] != entity_id or previous[1] != action or previous[2] != payload_hash:
                raise ValueError("Request ID reused for different task")
            return json.loads(previous[3])
        permitted = action in info["capabilities"]
        result = {"request_id":request_id,"entity_id":entity_id,"action":action,
                  "status":"completed" if permitted else "denied"}
        with self.db:
            if permitted and action == "memory.write":
                key = payload.get("key")
                if not isinstance(key,str) or not key:
                    raise ValueError("memory key required")
                self.db.execute("INSERT INTO memories(entity_id,key,value) VALUES (?,?,?) "
                                "ON CONFLICT(entity_id,key) DO UPDATE SET value=excluded.value",
                                (entity_id,key,json.dumps(payload.get("value"))))
            elif permitted and action == "story.plan":
                world_key = payload.get("world_key")
                canon = payload.get("canon")
                if info["kind"] != "creator" or not isinstance(world_key,str) or not world_key or not isinstance(canon,dict):
                    raise ValueError("Creator story.plan requires world_key and canon object")
                self.db.execute("INSERT INTO storyworlds(entity_id,world_key,canon) VALUES (?,?,?) "
                                "ON CONFLICT(entity_id,world_key) DO UPDATE SET canon=excluded.canon",
                                (entity_id,world_key,json.dumps(canon,sort_keys=True)))
            elif permitted and action == "creator.draft":
                world_key=payload.get("world_key")
                canon=self.storyworld(entity_id,world_key)
                if canon is None:
                    raise ValueError("Unknown storyworld")
                draft=draft_scene(info,canon,payload.get("prompt"))
                self.db.execute("INSERT INTO assets(entity_id,asset_id,data) VALUES (?,?,?) "
                                "ON CONFLICT(entity_id,asset_id) DO NOTHING",
                                (entity_id,draft["asset_id"],json.dumps(draft,sort_keys=True)))
                result["asset_id"]=draft["asset_id"]
            elif permitted and action == "creator.review":
                asset_id=payload.get("asset_id")
                decision=payload.get("decision")
                if decision not in ("approve","reject"):
                    raise ValueError("Review decision must be approve or reject")
                draft=self.asset(entity_id,asset_id)
                if draft is None:
                    raise ValueError("Unknown asset")
                if draft["approval_status"] != "pending":
                    raise ValueError("Asset already reviewed")
                if decision == "approve" and draft["rights_status"] != "cleared":
                    raise ValueError("Rights must be cleared before approval")
                draft["approval_status"]="approved" if decision=="approve" else "rejected"
                self.db.execute("UPDATE assets SET data=? WHERE entity_id=? AND asset_id=?",
                                (json.dumps(draft,sort_keys=True),entity_id,asset_id))
                result["asset_id"]=asset_id
            elif permitted and action == "creator.rights":
                asset_id=payload.get("asset_id")
                draft=self.asset(entity_id,asset_id)
                if draft is None:
                    raise ValueError("Unknown asset")
                if draft["approval_status"] != "pending":
                    raise ValueError("Cannot change rights after review")
                if payload.get("status") not in ("cleared","blocked"):
                    raise ValueError("Rights status must be cleared or blocked")
                evidence = payload.get("evidence")
                if payload["status"] == "cleared" and (not isinstance(evidence,str) or not evidence.strip()):
                    raise ValueError("Rights clearance requires an evidence reference")
                draft["rights_status"]=payload["status"]
                draft["rights_evidence_reference"]=evidence.strip() if isinstance(evidence,str) else None
                self.db.execute("UPDATE assets SET data=? WHERE entity_id=? AND asset_id=?",
                                (json.dumps(draft,sort_keys=True),entity_id,asset_id))
                result["asset_id"]=asset_id
            elif permitted and action not in ("memory.write","story.plan","creator.draft","creator.review","creator.rights"):
                # No adapters yet: allowed capabilities alone do not authorize side effects.
                result["status"] = "not_implemented"
            self._event(entity_id,"task."+result["status"],{"action":action,"request_id":request_id})
            self.db.execute("INSERT INTO tasks VALUES (?,?,?,?,?,?)",
                            (request_id,entity_id,action,payload_hash,json.dumps(result),now()))
        return result

    def asset(self, entity_id, asset_id):
        self.entity(entity_id)
        row=self.db.execute("SELECT data FROM assets WHERE entity_id=? AND asset_id=?",
                            (entity_id,asset_id)).fetchone()
        return json.loads(row[0]) if row else None

    def storyworld(self, entity_id, world_key):
        self.entity(entity_id)
        row = self.db.execute("SELECT canon FROM storyworlds WHERE entity_id=? AND world_key=?",
                              (entity_id,world_key)).fetchone()
        return json.loads(row[0]) if row else None

    def remember(self, entity_id, key):
        self.entity(entity_id)
        row=self.db.execute("SELECT value FROM memories WHERE entity_id=? AND key=?",
                            (entity_id,key)).fetchone()
        return json.loads(row[0]) if row else None

    def events(self, entity_id):
        self.entity(entity_id)
        rows=self.db.execute("SELECT event_type,payload,created_at FROM events WHERE entity_id=? ORDER BY id",
                             (entity_id,)).fetchall()
        return [{"type":t,"payload":json.loads(p),"at":a} for t,p,a in rows]

    def close(self):
        self.db.close()
