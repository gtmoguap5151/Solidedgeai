"""Offline creator engine: drafts are not approved or published."""
import hashlib
import json

def draft_scene(entity, canon, prompt):
    if entity.get("kind") != "creator":
        raise ValueError("Only creator entities can draft scenes")
    if not isinstance(canon,dict) or not canon.get("setting"):
        raise ValueError("Storyworld canon requires a setting")
    if not isinstance(prompt,str) or not prompt.strip():
        raise ValueError("A creative prompt is required")
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
