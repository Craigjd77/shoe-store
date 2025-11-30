# Sneaker Collection - E-Commerce Store

A full-stack web application for displaying and selling a collection of 200+ pairs of men's size 9 shoes. Features automatic image processing, AI-powered shoe identification, and a streamlined admin interface.

## Features

- 🛍️ **E-Commerce Storefront** - Browse and purchase shoes with shopping cart functionality
- 🤖 **AI-Powered Identification** - Automatically identifies brand, model, color, and estimates MSRP
- 📸 **Auto-Image Processing** - Converts HEIC to JPG, groups multiple images per shoe
- 🔄 **Auto-Publish** - Drop images in SHOES folder, they're automatically processed and published
- 👨‍💼 **Admin Panel** - Manage shoes, images, and inventory with drag-and-drop interface
- 🔐 **Authentication** - Secure admin login system
- 📱 **Responsive Design** - Works on desktop and mobile devices

## Tech Stack

- **Backend**: Node.js, Express.js, SQLite
- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Image Processing**: sips (macOS), ImageMagick
- **Database**: SQLite

## Installation

1. Clone the repository:
```bash
git clone <your-repo-url>
cd shoe-store
```

2. Install dependencies:
```bash
npm install
```

3. Create necessary folders:
```bash
mkdir -p SHOES uploads
```

4. Start the server:
```bash
npm start
```

5. Open your browser to `http://localhost:3000`

## Usage

### For Customers
- Browse shoes on the Shop page
- Use search and filters to find specific shoes
- Add items to cart and checkout

### For Admins
1. Click "Admin" in navigation
2. Login with credentials
3. **Auto-Publish Mode**: Simply drop images (HEIC or JPG) in the `SHOES` folder
   - Images are automatically converted (HEIC → JPG)
   - AI identifies brand, model, color, and price
   - Shoes are published within 10 seconds
4. **Manual Management**: Use the Admin panel to:
   - Drag and drop images to create new shoes
   - Add images to existing shoes
   - Edit shoe details
   - Delete shoes (single or bulk selection)

## Project Structure

```
shoe-store/
├── public/           # Frontend files (HTML, CSS, JS)
├── SHOES/           # Drop images here (auto-processed)
├── uploads/         # Processed images (auto-generated)
├── server.js        # Express server
├── auto-import.js   # Auto-import service
├── analyze-shoes.js # Image analysis and grouping
├── ai-identifier.js # AI-powered shoe identification
└── image-converter.js # HEIC to JPG conversion
```

## Configuration

The system automatically:
- Converts HEIC files to JPG
- Groups sequential images (IMG_####) into shoes
- Identifies brand, model, and color from filenames
- Estimates MSRP based on brand/model
- Prevents duplicate entries
- Cleans up duplicates on startup

## API Endpoints

- `GET /api/shoes` - Get all shoes
- `GET /api/shoes/:id` - Get single shoe
- `POST /api/shoes` - Create new shoe
- `PUT /api/shoes/:id` - Update shoe
- `DELETE /api/shoes/:id` - Delete shoe
- `POST /api/shoes/import` - Bulk import shoes
- `GET /api/auto-import/status` - Check auto-import status

## Notes

- Images in the `SHOES` folder are automatically processed
- Original HEIC files are deleted after conversion
- The system groups multiple images per shoe automatically
- Admin credentials are stored client-side (localStorage)

## License

ISC

## Author

Created for managing and selling a personal sneaker collection.
