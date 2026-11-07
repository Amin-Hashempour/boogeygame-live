#!/usr/bin/env python3
"""Build the static news feed consumed by the GitHub Pages site."""
import argparse
import concurrent.futures
import json
from pathlib import Path

from server import SOURCES, find_article_image, parse_feed, request_bytes


def fetch_source(code):
    name, base, paths = SOURCES[code]
    for path in paths:
        try:
            data, _ = request_bytes(
                base + path,
                accept='application/rss+xml, application/atom+xml, application/xml, text/xml',
            )
            items = parse_feed(data, base)
            missing = [item for item in items if not item['image']]
            if missing:
                with concurrent.futures.ThreadPoolExecutor(max_workers=min(6, len(missing))) as pool:
                    for item, image in zip(missing, pool.map(find_article_image, (item['url'] for item in missing))):
                        item['image'] = image
            return code, {'items': items, 'error': None}
        except Exception:
            continue
    return code, {
        'items': [],
        'error': f'دریافت مطالب {name} ممکن نشد؛ لطفاً بعداً دوباره تلاش کنید.',
    }


def build(output):
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(SOURCES)) as pool:
        result = dict(pool.map(fetch_source, SOURCES))
    if not any(source['items'] for source in result.values()):
        raise RuntimeError('No news source returned usable items')
    destination = Path(output)
    destination.parent.mkdir(parents=True, exist_ok=True)
    temporary = destination.with_suffix(destination.suffix + '.tmp')
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')
    temporary.replace(destination)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', default='news.json')
    args = parser.parse_args()
    build(args.output)
