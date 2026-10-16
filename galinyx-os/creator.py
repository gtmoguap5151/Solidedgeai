"""Offline creator engine: drafts are not approved or published."""
import hashlib
import json

def draft_scene(entity, canon, prompt):
    if entity.get("kind") != "creator":
        raise ValueError("Only creator entities can draft scenes")
    if not isinstance(canon,dict) or not isinstance(canon.get("setting"),str) or not canon["setting"].strip():
        raise ValueError("Storyworld canon requires a nonempty string setting")
    if len(canon["setting"])>256:
        raise ValueError("Storyworld setting exceeds 256 characters")
    if not isinstance(prompt,str) or not prompt.strip() or len(prompt)>4000:
        raise ValueError("Creative prompt must be 1-4000 characters")
    seed=json.dumps({"entity":entity["id"],"canon":canon,"prompt":prompt.strip()},sort_keys=True)
    asset_id=hashlib.sha256(seed.encode()).hexdigest()[:20]
    return {
        "asset_id":asset_id,
        "title":"A Scene in "+str(canon["setting"]),
        "outline":[
            "Establish the setting: "+str(canon["setting"]),
            "Introduce the creative premise: "+prompt.strip(),
            "Resolve the scene without contradicting established canon."
        ],
        "canon_snapshot":canon,
        "rights_status":"unreviewed",
        "approval_status":"pending",
        "published":False,
        "generation_mode":"deterministic_offline_template"
    }
