# Shoe Import Guide

## How to Import Your Shoes

### Step 1: Drop Images in SHOES Folder

1. Navigate to the `shoe-store` folder
2. You'll see a `SHOES` folder (created automatically)
3. Drop all your shoe images into this folder

**Naming Tips for Better Recognition:**
- `Nike-Dunk-Low-White.jpg` → Will be recognized as Nike Dunk Low
- `New-Balance-990v5-Grey.jpg` → Will be recognized as New Balance 990v5
- `adidas-Ultraboost-22-Black.jpg` → Will be recognized as adidas Ultraboost 22

### Step 2: Analyze Images

1. Go to the **Import Page** (http://localhost:3000/import.html)
2. Click **"Analyze Images"**
3. The system will:
   - Scan all images in the SHOES folder
   - Group images by similar filenames (same shoe)
   - Extract brand and model from filenames
   - Show you a preview of what will be imported

### Step 3: Review & Edit

The preview shows:
- **Brand** - Auto-detected (editable)
- **Model** - Auto-detected (editable)
- **Description** - From filename (editable)
- **MSRP** - Default $120 (editable)
- **Price** - Default $100 (editable)
- **Images** - Thumbnails of all images for that shoe

You can:
- Edit any field before importing
- Select/deselect which shoes to import
- Set default MSRP and Price for all shoes

### Step 4: Import

1. Select the shoes you want to import (or select all)
2. Review the default MSRP and Price
3. Click **"Import Selected Shoes"**
4. Images are automatically copied from SHOES folder to uploads folder
5. Shoes are added to the database

### Step 5: View Your Collection

1. Go to the **Shop** page (http://localhost:3000)
2. Your imported shoes will appear in the grid
3. Click any shoe to see details with all images

## How Shoes Will Display

### Home Page (Shop)
- Grid layout with shoe cards
- Primary image as thumbnail
- Brand, Model, and Price displayed
- Click to view details

### Product Detail Page
- Large main image with navigation arrows
- Thumbnail strip below for quick image switching
- Full product information
- Original MSRP and selling price
- Add to cart button

### Image Gallery Features
- Multiple views per shoe
- Thumbnail navigation
- Smooth image transitions
- Responsive design

## Supported Brands

The system recognizes these brands automatically:
- Nike
- New Balance
- adidas / Adidas
- Olukai
- LOWE
- Asics / ASICS
- Puma
- Vans
- Converse
- Jordan / Air Jordan
- Reebok
- Under Armour
- Saucony
- Brooks
- Hoka
- On
- Salomon
- Merrell
- Timberland

## File Organization

```
shoe-store/
├── SHOES/              ← Drop your images here
│   ├── nike-dunk-1.jpg
│   ├── nike-dunk-2.jpg
│   ├── new-balance-990.jpg
│   └── ...
├── uploads/            ← Images copied here after import
│   └── shoe-1-xxx.jpg
└── ...
```

## Tips

1. **Group images by shoe**: Name related images similarly
   - `nike-dunk-front.jpg`
   - `nike-dunk-side.jpg`
   - `nike-dunk-back.jpg`
   → Will be grouped as one shoe with 3 images

2. **Include brand in filename**: Helps with auto-detection
   - ✅ `Nike-Dunk-Low.jpg`
   - ❌ `dunk-low.jpg`

3. **Use descriptive names**: Better for organization
   - ✅ `Nike-Air-Force-1-White-Low.jpg`
   - ❌ `IMG_1234.jpg`

4. **Multiple images per shoe**: All images with similar base names will be grouped together

## Troubleshooting

**Images not showing in preview?**
- Make sure images are in the `SHOES` folder
- Check file extensions (.jpg, .jpeg, .png, .gif, .webp)
- Restart the server if needed

**Brand/Model not detected?**
- Edit manually in the preview before importing
- Use clearer filenames next time

**Import failed?**
- Check server console for errors
- Make sure uploads folder exists
- Verify image file permissions

## Next Steps After Import

1. Review imported shoes in the Shop page
2. Edit details in Admin panel if needed
3. Add more images using Admin panel
4. Set up pricing and descriptions
5. Start selling!

