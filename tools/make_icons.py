"""App icons for the GitHub Pages build: Copperline blue tile with a white shield and a pulse mark."""
from PIL import Image, ImageDraw

COPPER, WHITE = (78, 121, 167), (255, 255, 255)
S = 1024


def icon():
    img = Image.new('RGB', (S, S), COPPER)  # full bleed: phones round the corners themselves
    d = ImageDraw.Draw(img)
    shield = [(512, 190), (760, 285), (760, 520), (720, 650), (620, 760), (512, 830),
              (404, 760), (304, 650), (264, 520), (264, 285)]
    d.polygon(shield, fill=WHITE)
    d.line([(350, 520), (440, 520), (480, 430), (540, 620), (585, 520), (675, 520)], fill=COPPER, width=44, joint='curve')
    return img


if __name__ == '__main__':
    big = icon()
    for size, name in [(512, 'icon-512.png'), (192, 'icon-192.png'), (180, 'apple-touch-icon.png')]:
        big.resize((size, size), Image.LANCZOS).save('docs/' + name)
    print('icons written')
