# FireFlee: Fire Detection/Disaster Management and Evacuation Visualization System 

A real-time fire monitoring and evacuation visualization dashboard built for Uiversity Campuses. This application combines computer vision–based fire detection with an interactive evacuation map that dynamically guides people to safety when an emergency occurs using a greedy-based flow algorithm. 

## Features

- **Real-time CCTV Monitoring**: 2x2 grid of camera feeds with live timestamps
- **Fire Detection Alerts**: Visual and audio alerts when fire is detected
- **Interactive Evacuation Map**: Dynamic map showing safe evacuation routes for individuals intheir respective locations
- **Event Timeline**: Real-time timeline of system events and status
- **Cinematic UI**: Futuristic control center aesthetic with smooth animations

## Prerequisites
Frontend 
- Node.js 16+ and npm/yarn
- Video files in the `videos/` folder (see Assets section)

Backend: 
- Python version 3.11.1

## Installation

1. Install dependencies:
```bash
npm install
```

2. Add video files:
   
   **Option A:** Place videos in `public/videos/` folder:
   - `a.mp4` (Camera A feed)
   - `b.mp4` (Camera B feed)
   - `c.mp4` (Camera C feed)
   - `d.mp4` (Camera D feed)
   
   **Option B:** Place videos in root `videos/` folder and run:
   ```bash
   ./setup-videos.sh
   ```
   
   The app will work without videos (shows placeholder), but videos enhance the experience.

3. (Optional) Add alert sound to `public/sounds/alert.mp3`

## Running the Application

Start the development server:
```bash
npm run dev
```

The application will open at `http://localhost:3000`

## Project Structure

```
HackUMass25/
├── src/
│   ├── components/
│   │   ├── Dashboard.jsx          # Main dashboard layout
│   │   ├── SurveillanceGrid.jsx   # CCTV feed grid
│   │   ├── CameraFeed.jsx         # Individual camera component
│   │   ├── EvacuationMap.jsx      # Map visualization
│   │   ├── AlertPanel.jsx         # Emergency alert panel
│   │   └── Timeline.jsx           # Event timeline
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── public/
│   ├── sounds/
│   └── videos/                    # Place video files here
├── videos/                        # Video files directory
├── package.json
└── vite.config.js
```

## Assets Required

### Video Files
Place the following video files in the `videos/` folder:
- `cameraa.mp4` - Camera A feed (Main Quad)
- `camerab.mp4` - Camera B feed (Lasuen Walk)
- `camerac.mp4` - Camera C feed (Hoover Tower Road)
- `camerad.mp4` - Camera D feed (Campus Drive North)

### Audio Files
- `public/sounds/alert.mp3` - Alert sound (optional)

If video files are not available, the application will display placeholder content.

## Demo Flow

1. **Monitoring Mode**: The app starts in normal monitoring mode with all 4 camera feeds active
2. **Fire Detection**: After 5 seconds, a fire is simulated on Camera C
3. **Alert Mode**: Red alert flashes, evacuation routes appear on the map
4. **Evacuation Visualization**: Green routes animate, pedestrian icons move along paths
5. **Clear Alert**: Use the "Clear Alert" button to reset to normal mode

## Customization

### Camera Positions
Edit `cameraPositions` in `src/components/EvacuationMap.jsx` to adjust camera locations on the map.

### Safe Exits
Modify the `safeExits` array in `src/components/EvacuationMap.jsx` to add or change exit points.

### Colors
Update CSS variables in `src/index.css`:
- `--bg-primary`: Background color
- `--alert-red`: Alert/fire color
- `--safe-green`: Safe route color
- `--accent-blue`: Accent color

## Building for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## Technologies Used

- React 18
- Vite
- CSS3 (Animations & Transitions)
- SVG (Map visualization)

## License

This project is part of HackUMass 2025.
