import re

with open('src/core/services.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the broken star characters in feedback message
content = content.replace('${""˜…".repeat(input.rating)}${""˜†".repeat(5 - input.rating)}', '${"★".repeat(input.rating)}${"☆".repeat(5 - input.rating)}')

# Fix the broken arrow in status message  
content = content.replace('←' Feedback received (after feedback logged)', '→ Feedback received (after feedback logged)')

with open('src/core/services.ts', 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed services.ts')
