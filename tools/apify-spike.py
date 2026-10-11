"""Bounded preflight probes; stdlib only. Secrets/raw results stay Git-ignored."""
import argparse
import json
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL = ROOT / 'data' / 'apify-spike'
LOCAL.mkdir(parents=True, exist_ok=True)
config = {}
for line in (ROOT / '.env').read_text(encoding='utf-8').splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, value = line.split('=', 1)
        config[key.strip()] = value.strip().strip('"').strip("'")
TOKEN = config['APIFY_API_TOKEN']
ACTOR = config['APIFY_ACTOR_ID'].replace('/', '~')


def request(path, payload=None):
    req = urllib.request.Request('https://api.apify.com/v2/' + path,
        data=json.dumps(payload).encode() if payload is not None else None,
        headers={'Authorization': 'Bearer ' + TOKEN, 'Content-Type': 'application/json'})
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            return json.load(response)
    except urllib.error.HTTPError as exc:
        # Never emit raw upstream body, URL or headers.
        raise RuntimeError('Apify HTTP status ' + str(exc.code)) from None


def save(name, data):
    (LOCAL / name).write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')


def run_summary(data):
    return {key: data.get(key) for key in ['id', 'status', 'buildId',
        'buildNumber', 'startedAt', 'finishedAt', 'usageTotalUsd', 'chargedEventCounts',
        'options']}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['inspect', 'run', 'status', 'items'])
    parser.add_argument('--input')
    parser.add_argument('--run-id')
    parser.add_argument('--cap', default='0.10')
    args = parser.parse_args()
    if args.action == 'inspect':
        user = request('users/me')['data']
        print(json.dumps({'authentication': 'verified', 'plan': user.get('plan', {}).get('id')}, ensure_ascii=False))
        actor = request('acts/' + ACTOR)['data']
        save('actor.json', actor)
        print(json.dumps({key: actor.get(key) for key in ['id', 'name', 'isDeprecated', 'taggedBuilds', 'pricingInfos']}, ensure_ascii=False))
        build = request('acts/' + ACTOR + '/builds/default')['data']
        save('build.json', build)
        schema = json.loads(build['inputSchema'])
        print(json.dumps({'build': build['buildNumber'], 'fields': list(schema['properties'])}, ensure_ascii=False))
    elif args.action == 'run':
        cap = Decimal(args.cap)
        input_path = Path(args.input).resolve()
        if not input_path.is_relative_to(ROOT):
            raise RuntimeError('Probe input must remain in the project folder')
        payload = json.loads(input_path.read_text(encoding='utf-8'))
        ledger_path = LOCAL / 'ledger.json'
        ledger = json.loads(ledger_path.read_text()) if ledger_path.exists() else []
        if cap <= 0 or sum(Decimal(x['reserved_cap']) for x in ledger) + cap > Decimal('0.50'):
            raise RuntimeError('Total reserved run charge cap exceeds USD0.50')
        actor = json.loads((LOCAL / 'actor.json').read_text())
        build = json.loads((LOCAL / 'build.json').read_text())
        if not actor.get('pricingInfos') or not any(x.get('pricingModel') == 'PAY_PER_EVENT' for x in actor['pricingInfos']):
            raise RuntimeError('Expected pay-per-event pricing not established; do not launch')
        # Reserve before POST; an unknown launch outcome is never retried automatically.
        entry = {'reserved_cap': str(cap), 'state': 'dispatching', 'at': datetime.now(timezone.utc).isoformat()}
        ledger.append(entry)
        save('ledger.json', ledger)
        query = urllib.parse.urlencode({'build': build['buildNumber'], 'timeout': 120,
            'memory': 256, 'maxTotalChargeUsd': str(cap)})
        data = request('acts/' + ACTOR + '/runs?' + query, payload)['data']
        entry.update(state='created', run_id=data['id'])
        save('ledger.json', ledger)
        save(data['id'] + '.json', data)
        print(json.dumps(run_summary(data), ensure_ascii=False))
    else:
        data = request('actor-runs/' + args.run_id)['data']
        save(args.run_id + '.json', data)
        print(json.dumps(run_summary(data), ensure_ascii=False))
        if args.action == 'items':
            items = request('datasets/' + data['defaultDatasetId'] + '/items?clean=true&limit=100')
            save(args.run_id + '-items.json', items)
            print(json.dumps({'items': len(items), 'top_level_keys': [list(x.keys()) for x in items[:3]]}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except Exception as exc:
        print(type(exc).__name__ + ': ' + str(exc).replace(TOKEN, '[REDACTED]'))
        raise SystemExit(1)
