import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import generate_news


class StaticBuildTests(unittest.TestCase):
    def test_build_writes_page_feed(self):
        def source(code):
            return code, {'items': [{'id': code, 'url': f'https://example.org/{code}', 'title': code,
                                     'image': '', 'published': ''}], 'error': None}

        with tempfile.TemporaryDirectory() as directory, patch('generate_news.fetch_source', side_effect=source):
            output = Path(directory) / 'site' / 'news.json'
            generate_news.build(output)
            result = json.loads(output.read_text(encoding='utf-8'))
            self.assertEqual(set(result), set(generate_news.SOURCES))
            self.assertEqual(result['Z']['items'][0]['url'], 'https://example.org/Z')

    def test_build_fails_instead_of_publishing_empty_feed(self):
        failed = lambda code: (code, {'items': [], 'error': 'offline'})
        with tempfile.TemporaryDirectory() as directory, patch('generate_news.fetch_source', side_effect=failed):
            output = Path(directory) / 'news.json'
            with self.assertRaises(RuntimeError):
                generate_news.build(output)
            self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
