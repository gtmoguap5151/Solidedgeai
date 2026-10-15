"""Galinyx OS prototype: stdlib-only durable entity runtime. No external AI or payments."""
import json, sqlite3, uuid
from datetime import datetime, timezone
from pathlib import Path

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
        CREATE TABLE IF NOT EXISTS storyworlds(\n            entity_id TEXT NOT NULL, world_key TEXT NOT NULL, canon TEXT NOT NULL,\n            PRIMARY KEY(entity_id,world_key),\n            FOREIGN KEY(entity_id) REFERENCES entities(id));\n        CREATE TABLE IF NOT EXISTS tasks(
            request_id TEXT PRIMARY KEY, entity_id TEXT NOT NULL, action TEXT NOT NULL,
            result TEXT NOT NULL, created_at TEXT NOT NULL,
            FOREIGN KEY(entity_id) REFERENCES entities(id));
        """)
        self.db.commit()

    def create(self, name, kind, capabilities=()):
        if not name or not kind:
            raise ValueError("name and kind required")
        entity_id = str(uuid.uuid4())
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
        payload = payload or {}
        request_id = request_id or str(uuid.uuid4())
        previous = self.db.execute("SELECT entity_id,action,result FROM tasks WHERE request_id=?",(request_id,)).fetchone()
        if previous:
            if previous[0] != entity_id or previous[1] != action:
                raise ValueError("Request ID reused for different task")
            return json.loads(previous[2])
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
            elif permitted and action == "story.plan":\n                world_key = payload.get("world_key")\n                canon = payload.get("canon")\n                if info["kind"] != "creator" or not isinstance(world_key,str) or not world_key or not isinstance(canon,dict):\n                    raise ValueError("Creator story.plan requires world_key and canon object")\n                self.db.execute("INSERT INTO storyworlds(entity_id,world_key,canon) VALUES (?,?,?) "\n                                "ON CONFLICT(entity_id,world_key) DO UPDATE SET canon=excluded.canon",\n                                (entity_id,world_key,json.dumps(canon,sort_keys=True)))\n            elif permitted and action not in ("memory.write","story.plan"):
                # No adapters yet: allowed capabilities alone do not authorize side effects.
                result["status"] = "not_implemented"
            self._event(entity_id,"task."+result["status"],{"action":action,"request_id":request_id})
            self.db.execute("INSERT INTO tasks VALUES (?,?,?,?,?)",
                            (request_id,entity_id,action,json.dumps(result),now()))
        return result

    def storyworld(self, entity_id, world_key):\n        self.entity(entity_id)\n        row = self.db.execute("SELECT canon FROM storyworlds WHERE entity_id=? AND world_key=?",\n                              (entity_id,world_key)).fetchone()\n        return json.loads(row[0]) if row else None\n\n    def remember(self, entity_id, key):
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
