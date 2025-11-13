# Face Recognition Setup Guide

This guide will help you set up the face recognition system for the attendance management application on both Windows and Linux platforms.

## Table of Contents

- [Prerequisites](#prerequisites)
- [Windows Setup](#windows-setup)
- [Linux Setup](#linux-setup)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)
- [Testing](#testing)

---

## Prerequisites

### Windows

- **Python 3.11 or 3.12** (recommended)
  - Download from [python.org](https://www.python.org/downloads/)
  - Make sure to check "Add Python to PATH" during installation
- **Visual Studio Build Tools** (required for compiling `dlib`)
  - Download from [Visual Studio Downloads](https://visualstudio.microsoft.com/downloads/)
  - Install "Desktop development with C++" workload
  - Or install the standalone [Build Tools](https://visualstudio.microsoft.com/downloads/#build-tools-for-visual-studio-2022)
- **CMake** (required for `dlib`)
  - Download from [cmake.org](https://cmake.org/download/)
  - Or install via: `winget install Kitware.CMake`
  - Add CMake to PATH during installation

### Linux

- **Python 3.8+** (usually pre-installed)
  - Check version: `python3 --version`
  - Install if needed: `sudo apt-get install python3 python3-pip python3-venv`
- **Build Tools** (required for compiling `dlib`)
  ```bash
  sudo apt-get update
  sudo apt-get install -y build-essential cmake
  ```
- **Additional dependencies** (for image processing)
  ```bash
  sudo apt-get install -y libopenblas-dev liblapack-dev libjpeg-dev libpng-dev
  ```

---

## Windows Setup

### Step 1: Navigate to Backend Directory

```powershell
cd "C:\path\to\your\project\backend"
```

### Step 2: Create Virtual Environment

```powershell
python -m venv venv
```

### Step 3: Activate Virtual Environment

```powershell
# PowerShell
.\venv\Scripts\Activate.ps1

# If you get an execution policy error, run:
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Command Prompt (CMD)
venv\Scripts\activate.bat
```

### Step 4: Upgrade pip and Build Tools

```powershell
python -m pip install --upgrade pip setuptools wheel
```

### Step 5: Install Dependencies

```powershell
# Install basic packages first
pip install numpy pillow opencv-python

# Install dlib (this will take 10-30 minutes as it compiles from source)
pip install dlib

# Install face-recognition
pip install face-recognition
```

**Note:** If `dlib` installation fails, you can try:
```powershell
# Alternative: Use pre-built wheel (if available for your Python version)
pip install dlib-binary
pip install face-recognition
```

### Step 6: Verify Installation

```powershell
python -c "import face_recognition; import dlib; print('All packages installed successfully!')"
```

---

## Linux Setup

### Step 1: Navigate to Backend Directory

```bash
cd /path/to/your/project/backend
```

### Step 2: Create Virtual Environment

```bash
python3 -m venv venv
```

**Note:** On some Linux distributions (like Kali Linux), you may need to install `python3-venv` first:
```bash
sudo apt-get install python3-venv
```

### Step 3: Activate Virtual Environment

```bash
source venv/bin/activate
```

You should see `(venv)` prefix in your terminal prompt.

### Step 4: Upgrade pip and Build Tools

```bash
pip install --upgrade pip setuptools wheel
```

### Step 5: Install System Dependencies (if not already installed)

```bash
# Install build tools and CMake
sudo apt-get update
sudo apt-get install -y build-essential cmake

# Install additional libraries for image processing
sudo apt-get install -y libopenblas-dev liblapack-dev libjpeg-dev libpng-dev
```

### Step 6: Install Python Dependencies

```bash
# Install basic packages first
pip install numpy pillow opencv-python

# Install dlib (this will take 10-30 minutes as it compiles from source)
pip install dlib

# Install face-recognition
pip install face-recognition
```

**Note:** The `dlib` installation will compile from source, which requires:
- CMake
- C++ compiler (g++)
- Sufficient RAM (at least 2GB free)

### Step 7: Verify Installation

```bash
python3 -c "import face_recognition; import dlib; print('All packages installed successfully!')"
```

---

## Verification

### Check Python Version

**Windows:**
```powershell
python --version
```

**Linux:**
```bash
python3 --version
```

### Check Installed Packages

**Both Platforms:**
```bash
# With venv activated
pip list | grep -E "(face-recognition|dlib|opencv|numpy|pillow)"
```

### Test Face Recognition Service

**Both Platforms:**
```bash
# With venv activated and in backend directory
python face_recognition_service.py encode
# Then paste: {"image":"test"}
# Press Ctrl+D (Linux) or Ctrl+Z then Enter (Windows) to send
```

---

## Configuration

The Node.js server (`index.js`) automatically detects and uses the virtual environment's Python. No additional configuration is needed!

### How It Works

1. The server checks for `venv/bin/python3` (Linux) or `venv/Scripts/python.exe` (Windows)
2. If found, it uses the virtual environment's Python
3. If not found, it falls back to system Python (`python3` or `py`)

### Manual Override (if needed)

If you want to use a different Python installation, you can modify the `getPythonCommand()` function in `index.js`:

```javascript
function getPythonCommand() {
  // Custom Python path
  const customPython = '/path/to/your/python3';
  return { command: customPython, args: ['face_recognition_service.py'] };
}
```

---

## Troubleshooting

### Issue: "ModuleNotFoundError: No module named 'face_recognition'"

**Solution:**
- Make sure the virtual environment is activated
- Verify packages are installed: `pip list | grep face-recognition`
- Reinstall if needed: `pip install --force-reinstall face-recognition`

### Issue: "dlib installation fails"

**Windows:**
- Ensure Visual Studio Build Tools are installed
- Make sure CMake is in PATH
- Try installing with: `pip install cmake` first, then `pip install dlib`

**Linux:**
- Install build tools: `sudo apt-get install build-essential cmake`
- Install additional libraries: `sudo apt-get install libopenblas-dev liblapack-dev`
- Increase swap space if you run out of memory during compilation

### Issue: "EPIPE error" in Node.js

**Solution:**
- This error is now handled gracefully in the code
- Check Python stderr output in the server logs for actual errors
- Verify the Python script can run independently

### Issue: "Python process failed" or "No output"

**Solution:**
1. Test Python script directly:
   ```bash
   python face_recognition_service.py encode
   # Paste: {"image":"test"}
   ```
2. Check if all dependencies are installed
3. Verify Python version compatibility (3.8-3.13)
4. Check server logs for detailed error messages

### Issue: Virtual environment not detected

**Solution:**
- Ensure `venv` directory exists in the `backend` folder
- Check file permissions: `ls -la venv/bin/python3` (Linux)
- Verify the path in `index.js` matches your setup

### Issue: "externally-managed-environment" error (Linux)

**Solution:**
- This is expected on modern Linux distributions (Kali, Ubuntu 23.04+)
- Always use a virtual environment: `python3 -m venv venv`
- Activate it before installing: `source venv/bin/activate`

---

## Testing

### Test 1: Basic Import Test

```bash
# With venv activated
python3 -c "import face_recognition, dlib, cv2, numpy, PIL; print('All imports successful!')"
```

### Test 2: Face Recognition Service

```bash
# With venv activated, in backend directory
echo '{"image":"data:image/jpeg;base64,/9j/4AAQSkZJRg=="}' | python face_recognition_service.py encode
```

### Test 3: Full Integration Test

1. Start the Node.js server:
   ```bash
   cd backend
   node index.js
   # or
   nodemon index.js
   ```

2. Check server logs for:
   ```
   Using Python: /path/to/backend/venv/bin/python3 face_recognition_service.py encode
   ```

3. Test face enrollment endpoint via API

---

## Performance Notes

- **dlib compilation**: Takes 10-30 minutes on first install
- **Face encoding**: Takes 1-3 seconds per image
- **Face comparison**: Takes <100ms per comparison
- **Memory usage**: ~500MB-1GB for face recognition operations

---

## Platform-Specific Notes

### Windows

- Use PowerShell for better compatibility
- Visual Studio Build Tools are required (not just Visual Studio Code)
- Python 3.11 or 3.12 recommended (3.13 may have compatibility issues)

### Linux

- Most distributions have Python 3 pre-installed
- Kali Linux requires `python3-venv` package
- Ubuntu 23.04+ has PEP 668 protection (always use venv)
- Debian/Ubuntu: Use `apt-get` for system packages
- Arch Linux: Use `pacman -S python python-pip cmake base-devel`

---

## Quick Reference

### Windows Commands

```powershell
# Create venv
python -m venv venv

# Activate
.\venv\Scripts\Activate.ps1

# Install
pip install numpy pillow opencv-python dlib face-recognition

# Deactivate
deactivate
```

### Linux Commands

```bash
# Create venv
python3 -m venv venv

# Activate
source venv/bin/activate

# Install system deps
sudo apt-get install build-essential cmake

# Install Python packages
pip install numpy pillow opencv-python dlib face-recognition

# Deactivate
deactivate
```

---

## Support

If you encounter issues not covered in this guide:

1. Check the server logs for detailed error messages
2. Verify all prerequisites are installed
3. Test the Python script independently
4. Check Python version compatibility
5. Review the troubleshooting section above

---

## Version Information

- **face-recognition**: 1.3.0
- **dlib**: 19.24.1
- **opencv-python**: 4.8.0.74+
- **numpy**: 1.24.3+
- **Pillow**: 10.0.0+
- **Python**: 3.8 - 3.13 (3.11-3.12 recommended)

---

*Last updated: October 2024*

