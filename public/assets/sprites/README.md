# Custom Sprites

Place your custom sprite files in this directory to replace the default generated sprites.

## Supported Sprites:

### Player Characters
- **player.png** - Player character neutral pose (32x32)
- **player_left.png** - Player character facing left (32x32)
- **player_right.png** - Player character facing right (32x32)

### Trees
- **tree.png** - Normal trees (16x40)
- **sturdy_tree.png** - Sturdy trees, harder to chop (18x42)
- **oak_tree.png** - Oak trees, drops oak wood (20x45)
- **maple_tree.png** - Maple trees, drops maple syrup (18x42)
- **birch_tree.png** - Birch trees, drops birch bark (16x40)
- **pine_tree.png** - Pine trees, drops pine resin (18x45)

### Enemies
- **stump_enemy.png** - Stump enemies (24x16)
- **spirit_enemy.png** - Spirit enemies (24x24)

### Environment
- **mountain.png** - Mountain boundaries (100x150)
- **base_building.png** - Main base building (150x80)
- **base_marker.png** - Golden base marker (50x50)
- **ground.png** - Ground texture (800x100)

## Default Generated Colors:

If you don't provide custom sprites, the game generates simple colored shapes:

### Player
- **Brown** rectangles with simple black dot eyes and mouth
- Different face directions for left/right sprites

### Trees
- **Trunk colors**: Brown (most), Light brown (birch), Dark brown (oak)
- **Leaf colors**: Green (normal/oak), Dark green (sturdy/pine), Red (maple), Light green (birch)

### Enemies
- **Stump**: Brown rectangle with darker brown center
- **Spirit**: Purple circle with dark purple "eyes"

### Environment
- **Mountain**: Gray rectangle with lighter gray inset
- **Base Building**: Brown rectangle with darker brown inset
- **Base Marker**: Gold circle with orange center
- **Ground**: Green rectangle

## How to Use:

1. Create PNG files with the exact names listed above
2. Place them in this `/public/assets/sprites/` directory
3. Restart the game to see your custom sprites
4. The game will automatically detect and load custom sprites

## Technical Details:

- **Format**: PNG format recommended for transparency support
- **Loading**: Custom sprites are loaded first, fallbacks generated if missing
- **Performance**: No performance difference between custom and generated sprites
- **Hot Reload**: Changes require game restart to take effect

## Tips for Custom Sprites:

- Match the recommended dimensions for best visual results
- Use transparency (alpha channel) for irregular shapes
- Keep file sizes reasonable for faster loading
- Test sprites in-game to ensure they look good at the target resolution
- Consider the game's pixel art aesthetic when designing sprites

## Notes:

- If a custom sprite file is missing or fails to load, the game automatically uses a generated fallback
- All sprite files are optional - the game works perfectly with generated sprites
- The game console will log which custom sprites were loaded successfully