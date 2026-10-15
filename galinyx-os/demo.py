"""Run: python galinyx-os/demo.py"""
from runtime import Runtime

runtime=Runtime()
creator=runtime.create("Nyx Studio","creator",["memory.write","story.plan"])
researcher=runtime.create("Galinyx Research","researcher",["memory.write"])
runtime.execute(creator,"memory.write",{"key":"canon","value":{"setting":"The Observatory","chapter":1}})
print("Creator:",runtime.entity(creator))
print("Researcher:",runtime.entity(researcher))
print("Creator memory:",runtime.remember(creator,"canon"))
print("Researcher cannot read creator memory:",runtime.remember(researcher,"canon"))
print("Creator story plan:",runtime.execute(creator,"story.plan"))
print("Researcher story plan:",runtime.execute(researcher,"story.plan"))
print("Unauthorized publication:",runtime.execute(creator,"social.publish"))
print("Unauthorized transfer:",runtime.execute(creator,"payments.transfer"))
print("Audit events:",len(runtime.events(creator)))
runtime.close()
