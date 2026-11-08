"""Print the first article URL from an RSS or Atom document on stdin."""
import sys
import xml.etree.ElementTree as ET


def local(node):
    return node.tag.rsplit('}', 1)[-1]


root = ET.fromstring(sys.stdin.buffer.read())
entry = next(node for node in root.iter() if local(node) in ('item', 'entry'))
link = next(node for node in entry.iter() if local(node) == 'link')
print((link.get('href') or link.text or '').strip())
