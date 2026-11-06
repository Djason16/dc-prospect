# Draws the top of the GitHub README (assets/readme/banner.png) and the section line (line.png),
# in the same layout as the DC Scaffold banner, with the mint colours of DC Prospect.
# Needs Python with Pillow:  python scripts/make-banner.py
# Fonts: Barlow Condensed ExtraBold and SemiBold (build/fonts, SIL Open Font License).
import random
from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BUILD = ROOT / 'build'
OUT = ROOT / 'assets' / 'readme'

INK = (9, 10, 13)
MINT, TEAL, DEEP = (126, 230, 168), (34, 170, 150), (16, 96, 88)


def blur_shape(size, draw_shape, radius):
    layer = Image.new('RGBA', size, (0, 0, 0, 0))
    draw_shape(ImageDraw.Draw(layer))
    return layer.filter(ImageFilter.GaussianBlur(radius))


def grain(size, strength):
    random.seed(7)
    noise = Image.effect_noise((size[0] // 2, size[1] // 2), 64).resize(size)
    return Image.merge('RGBA', [noise, noise, noise, Image.new('L', size, strength)])


def font(name, size):
    return ImageFont.truetype(str(BUILD / 'fonts' / f'BarlowCondensed-{name}.woff'), size)


def gradient(width, height, a, b):
    bar = Image.linear_gradient('L').rotate(90).resize((width, height))
    return Image.merge('RGB', [bar.point(lambda v, x=x, y=y: int(x + (y - x) * v / 255)) for x, y in zip(a, b)])


def banner():
    S = 4
    w, h = 1280 * S, 400 * S
    image = Image.new('RGBA', (w, h), INK + (255,))

    # Aurora on the right (teal, mint, deep green)
    image = Image.alpha_composite(image, blur_shape((w, h), lambda d: d.polygon([(w * 0.48, 0), (w * 1.05, 0), (w * 0.95, h * 0.75), (w * 0.42, h * 0.55)], fill=TEAL + (130,)), 70 * S))
    image = Image.alpha_composite(image, blur_shape((w, h), lambda d: d.polygon([(w * 0.70, 0), (w * 1.05, 0), (w * 1.05, h * 0.45), (w * 0.62, h * 0.30)], fill=MINT + (150,)), 55 * S))
    image = Image.alpha_composite(image, blur_shape((w, h), lambda d: d.ellipse([w * 0.70, h * 0.45, w * 1.05, h * 1.15], fill=DEEP + (140,)), 80 * S))

    # Fine vertical grid fading towards the bottom
    lines = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(lines)
    for x in range(40 * S, w, 80 * S):
        draw.line([(x, 0), (x, h)], fill=(255, 255, 255, 15), width=S)
    fade = Image.linear_gradient('L').resize((w, h)).point(lambda v: 255 - v)
    lines.putalpha(ImageChops.multiply(lines.getchannel('A'), fade))
    image = Image.alpha_composite(image, lines)

    # Thin light beam across the aurora
    beam = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(beam).line([(w * 0.70, h), (w * 0.93, 0)], fill=(255, 255, 255, 60), width=S)
    image = Image.alpha_composite(image, beam)

    # Round DC Prospect icon with its glow
    x0, y0, size = 72 * S, 64 * S, 84 * S
    image = Image.alpha_composite(image, blur_shape((w, h), lambda d: d.ellipse([x0, y0 + 14 * S, x0 + size, y0 + size + 14 * S], fill=MINT + (110,)), 18 * S))
    icon = Image.open(BUILD / 'icon.png').convert('RGBA').resize((size, size), Image.LANCZOS)
    image.alpha_composite(icon, (x0, y0))

    draw = ImageDraw.Draw(image)
    # Title on one line, very large
    draw.text((68 * S, 292 * S), 'DC PROSPECT', font=font('ExtraBold', 150 * S), fill=(255, 255, 255), anchor='ls')
    # Gradient bar under the title
    image.paste(gradient(96 * S, 5 * S, MINT, TEAL), (74 * S, 314 * S))
    # Tagline
    draw.text((74 * S, 356 * S), 'LA PROSPECTION PAR E-MAIL  ·  FAITE À TA PLACE', font=font('SemiBold', 22 * S), fill=(255, 255, 255, 150), anchor='ls')

    # Djason CHERY at the bottom right
    logo = Image.open(BUILD / 'logo-light.png').convert('RGBA')
    logo = logo.resize((150 * S, int(150 * S * logo.height / logo.width)), Image.LANCZOS)
    image.alpha_composite(logo, (w - 72 * S - logo.width, h - 40 * S - logo.height))

    image = Image.alpha_composite(image, grain((w, h), 9))
    OUT.mkdir(parents=True, exist_ok=True)
    image.convert('RGB').resize((2560, 800), Image.LANCZOS).save(OUT / 'banner.png', optimize=True)
    # Gradient line between the sections of the README
    gradient(2560, 6, MINT, TEAL).save(OUT / 'line.png', optimize=True)


banner()
print('assets/readme/banner.png, assets/readme/line.png')
