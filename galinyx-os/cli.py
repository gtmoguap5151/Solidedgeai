"""GALINYX OS local developer CLI.

This is a trusted-local development interface, not an authenticated network API.
"""
import argparse
import json
import sys
from pathlib import Path

from contracts import validate_entity_manifest
from runtime import Runtime

def _json_file(path):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        raise ValueError(f"cannot read JSON file {path}: {exc}") from exc

def build_parser():
    parser = argparse.ArgumentParser(prog="galinyx", description="GALINYX OS local developer tools")
    sub = parser.add_subparsers(dest="command", required=True)

    init = sub.add_parser("init", help="initialize a local runtime database")
    init.add_argument("--database", default="galinyx.db")

    validate = sub.add_parser("validate-manifest", help="validate a versioned entity manifest")
    validate.add_argument("manifest")

    create = sub.add_parser("create-entity", help="create an entity from a manifest")
    create.add_argument("manifest")
    create.add_argument("--database", default="galinyx.db")

    inspect = sub.add_parser("inspect-entity", help="inspect one local entity")
    inspect.add_argument("entity_id")
    inspect.add_argument("--database", default="galinyx.db")

    listing = sub.add_parser("list-entities", help="list local entities")
    listing.add_argument("--database", default="galinyx.db")

    events = sub.add_parser("events", help="show an entity's event history")
    events.add_argument("entity_id")
    events.add_argument("--database", default="galinyx.db")

    task = sub.add_parser("run-task", help="run a locally authorized prototype action")
    task.add_argument("entity_id")
    task.add_argument("action")
    task.add_argument("--input", default="{}", help="JSON object passed to the action")
    task.add_argument("--request-id")
    task.add_argument("--database", default="galinyx.db")
    return parser

def main(argv=None):
    args = build_parser().parse_args(argv)
    if args.command == "validate-manifest":
        manifest = validate_entity_manifest(_json_file(args.manifest))
        print(json.dumps({"valid": True, "schema_version": manifest["schema_version"]}))
        return 0

    runtime = Runtime(args.database)
    try:
        if args.command == "init":
            print(json.dumps({"initialized": True, "schema_version": runtime.schema_version(),
                              "database": str(args.database)}))
        elif args.command == "create-entity":
            entity_id = runtime.create_from_manifest(_json_file(args.manifest))
            print(json.dumps(runtime.entity(entity_id), sort_keys=True))
        elif args.command == "inspect-entity":
            print(json.dumps(runtime.entity(args.entity_id), sort_keys=True))
        elif args.command == "list-entities":
            print(json.dumps(runtime.list_entities(), sort_keys=True))
        elif args.command == "events":
            print(json.dumps(runtime.events(args.entity_id), sort_keys=True))
        elif args.command == "run-task":
            try:
                payload = json.loads(args.input)
            except json.JSONDecodeError as exc:
                raise ValueError(f"--input must be valid JSON: {exc}") from exc
            result = runtime.execute(args.entity_id, args.action, payload, args.request_id)
            print(json.dumps(result, sort_keys=True))
            return 0 if result["status"] in ("completed", "denied", "not_implemented") else 1
        return 0
    except (ValueError, KeyError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 2
    finally:
        runtime.close()

if __name__ == "__main__":
    raise SystemExit(main())
