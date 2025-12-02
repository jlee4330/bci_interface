from PIL import Image
import os

# 입력 시트
sheet = Image.open("spritesheet2.png")

# 타일 개수 설정 (가로 2, 세로 3 → 총 6)
cols, rows = 2, 3

# 타일 크기 계산
tile_width = sheet.width // cols
tile_height = sheet.height // rows

# 출력 폴더
output_dir = "output_tiles"
os.makedirs(output_dir, exist_ok=True)

# 타일 자르기
count = 0
for j in range(rows):
    for i in range(cols):
        x0 = i * tile_width
        y0 = j * tile_height
        x1 = x0 + tile_width
        y1 = y0 + tile_height

        tile = sheet.crop((x0, y0, x1, y1))
        tile.save(os.path.join(output_dir, f"tile_{count}.png"))
        count += 1

print(f"✅ {count} tiles saved to {output_dir}/")
