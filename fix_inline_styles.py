from pathlib import Path
import re

path = Path(r'c:\Users\ISHMAEL\Pictures\Camera Roll\madiva enhanced final\madiva enhanced final\madiva enhanced final\Mad\public\madiva-cbo.html')
text = path.read_text(encoding='utf-8')

style_block_start = text.index('<style>')
style_block_end = text.index('</style>', style_block_start)
style_block = text[style_block_start:style_block_end + len('</style>')]

style_map = {}
class_counter = 1


def get_class_name(style_value: str) -> str:
    global class_counter
    if style_value in style_map:
        return style_map[style_value]
    class_name = f'ui-{class_counter}'
    class_counter += 1
    style_map[style_value] = class_name
    return class_name


def replace_style_attrs(fragment: str) -> str:
    def repl(match: re.Match) -> str:
        tag = match.group(0)
        style_match = re.search(r'\bstyle\s*=\s*(["\'])(.*?)\1', tag)
        if not style_match:
            return tag
        style_value = style_match.group(2)
        class_name = get_class_name(style_value)
        class_match = re.search(r'(\bclass\s*=\s*)(["\'])(.*?)\2', tag)
        if class_match:
            existing = class_match.group(3)
            classes = existing.split() if existing else []
            if class_name not in classes:
                classes.append(class_name)
            new_tag = tag[:class_match.start(3)] + ' '.join(classes) + tag[class_match.end(3):]
        else:
            if tag.rstrip().endswith('/>'):
                new_tag = tag[:-2] + f' class="{class_name}"/>'
            else:
                new_tag = tag[:-1] + f' class="{class_name}">'
        return new_tag.replace(style_match.group(0), '', 1)

    return re.sub(r'<[^>]+\bstyle\s*=\s*(["\']).*?\1[^>]*>', repl, fragment)

# Process the whole file, including JS template strings.
processed_text = replace_style_attrs(text)

# Add generated CSS rules.
css_rules = [f'.{class_name} {{ {style_value}; }}' for style_value, class_name in style_map.items()]
if css_rules:
    css_block = style_block.replace('</style>', '\n' + '\n'.join(css_rules) + '\n</style>')
    processed_text = processed_text.replace(style_block, css_block, 1)

path.write_text(processed_text, encoding='utf-8')
print(f'Updated {len(style_map)} inline-style classes.')
