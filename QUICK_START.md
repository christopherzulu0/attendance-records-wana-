# Quick Start Guide - Face Recognition Setup

## Windows (5 minutes)

```powershell
# 1. Install prerequisites (one-time setup)
# - Python 3.11 from python.org
# - Visual Studio Build Tools (Desktop development with C++)
# - CMake from cmake.org

# 2. Setup (in backend directory)
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install --upgrade pip setuptools wheel
pip install numpy pillow opencv-python
pip install dlib face-recognition  # Takes 10-30 minutes

# 3. Verify
python -c "import face_recognition; print('Success!')"
```

## Linux (5 minutes)

```bash
# 1. Install prerequisites
sudo apt-get update
sudo apt-get install -y python3 python3-pip python3-venv build-essential cmake

# 2. Setup (in backend directory)
python3 -m venv venv
source venv/bin/activate
pip install --upgrade pip setuptools wheel
pip install numpy pillow opencv-python
pip install dlib face-recognition  # Takes 10-30 minutes

# 3. Verify
python3 -c "import face_recognition; print('Success!')"
```

## That's It!

The Node.js server automatically detects and uses the virtual environment. Just restart your server:

```bash
node index.js
# or
nodemon index.js
```

**Note:** The server will automatically use `venv/bin/python3` (Linux) or `venv/Scripts/python.exe` (Windows) if the virtual environment exists.

For detailed troubleshooting, see [FACE_RECOGNITION_SETUP_GUIDE.md](./FACE_RECOGNITION_SETUP_GUIDE.md)

