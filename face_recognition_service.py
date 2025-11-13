"""
Face Recognition Service using dlib and face_recognition library
Provides accurate, production-grade face recognition using deep learning
"""

import face_recognition
import cv2
import numpy as np
import base64
import io
from PIL import Image
import json
import sys

def decode_base64_image(base64_string):
    """Decode base64 string to numpy array"""
    try:
        # Remove data URL prefix if present
        if ',' in base64_string:
            base64_string = base64_string.split(',')[1]
        
        # Decode base64
        image_data = base64.b64decode(base64_string)
        image = Image.open(io.BytesIO(image_data))
        
        # Convert to RGB (required by face_recognition library)
        if image.mode != 'RGB':
            image = image.convert('RGB')
        
        # Convert PIL to numpy array
        image_array = np.array(image)
        
        return image_array
    except Exception as e:
        print(f"Error decoding image: {str(e)}", file=sys.stderr)
        return None

def generate_face_encoding(base64_image):
    """
    Generate face encoding from base64 image using dlib's ResNet model
    Returns 128-dimensional encoding
    """
    try:
        # Decode image
        image_array = decode_base64_image(base64_image)
        if image_array is None:
            return {
                'success': False,
                'error': 'Failed to decode image'
            }
        
        # Detect faces in the image
        face_locations = face_recognition.face_locations(image_array, model='hog')
        
        if len(face_locations) == 0:
            return {
                'success': False,
                'error': 'No face detected. Please ensure your face is clearly visible and well-lit.'
            }
        
        if len(face_locations) > 1:
            return {
                'success': False,
                'error': 'Multiple faces detected. Please ensure only one person is in frame.'
            }
        
        # Generate face encoding using deep learning
        face_encodings = face_recognition.face_encodings(image_array, face_locations)
        
        if len(face_encodings) == 0:
            return {
                'success': False,
                'error': 'Could not generate face encoding. Please try again with better lighting.'
            }
        
        encoding = face_encodings[0]
        face_location = face_locations[0]
        
        # Validate encoding quality
        variance = np.var(encoding)
        if variance < 0.001:
            return {
                'success': False,
                'error': 'Poor quality face encoding. Please ensure good lighting and face the camera directly.'
            }
        
        # Calculate face size as quality indicator
        top, right, bottom, left = face_location
        face_height = bottom - top
        face_width = right - left
        image_height, image_width = image_array.shape[:2]
        
        # Face should be at least 15% of image for good quality
        face_coverage = (face_height * face_width) / (image_height * image_width)
        
        if face_coverage < 0.05:
            return {
                'success': False,
                'error': 'Face is too small. Please move closer to the camera.'
            }
        
        return {
            'success': True,
            'encoding': encoding.tolist(),  # Convert numpy array to list for JSON
            'face_location': {
                'top': int(top),
                'right': int(right),
                'bottom': int(bottom),
                'left': int(left)
            },
            'face_coverage': float(face_coverage),
            'confidence': 0.95
        }
        
    except Exception as e:
        print(f"Error generating encoding: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            'success': False,
            'error': f'Error processing image: {str(e)}'
        }

def compare_faces(encoding1_json, encoding2_json, tolerance=0.5):
    """
    Compare two face encodings using face_recognition library
    
    Args:
        encoding1_json: First face encoding (list)
        encoding2_json: Second face encoding (list)
        tolerance: Distance threshold (default 0.5 for stricter matching)
                   Lower = stricter (0.4 = very strict, 0.6 = lenient)
    
    Returns:
        dict with match result, similarity score, and distance
    """
    try:
        # Convert lists to numpy arrays
        encoding1 = np.array(encoding1_json)
        encoding2 = np.array(encoding2_json)
        
        if len(encoding1) != 128 or len(encoding2) != 128:
            return {
                'match': False,
                'similarity': 0.0,
                'error': f'Invalid encoding dimensions: {len(encoding1)}, {len(encoding2)}. Expected 128.'
            }
        
        # Calculate face distance (Euclidean distance)
        # face_recognition library uses this method
        distance = np.linalg.norm(encoding1 - encoding2)
        
        # Check if faces match based on tolerance
        is_match = distance <= tolerance
        
        # Convert distance to similarity percentage
        # Distance of 0 = 100% similar, distance of 1 = 0% similar
        # We use a scaling factor for better percentage representation
        similarity = max(0.0, 1.0 - (distance / 1.0))
        similarity_percent = similarity * 100
        
        return {
            'match': bool(is_match),
            'similarity': float(similarity),
            'similarity_percent': float(similarity_percent),
            'distance': float(distance),
            'threshold': float(tolerance),
            'quality': 'excellent' if distance < 0.3 else 'good' if distance < 0.5 else 'poor'
        }
        
    except Exception as e:
        print(f"Error comparing faces: {str(e)}", file=sys.stderr)
        import traceback
        traceback.print_exc(file=sys.stderr)
        return {
            'match': False,
            'similarity': 0.0,
            'error': str(e)
        }

if __name__ == '__main__':
    """
    Command-line interface - reads data from stdin
    Usage: 
        echo '{"image":"..."}' | python face_recognition_service.py encode
        echo '{"encoding1":[...], "encoding2":[...]}' | python face_recognition_service.py compare
    """
    if len(sys.argv) < 2:
        print("Usage: python face_recognition_service.py <command>")
        print("Commands:")
        print("  encode  - Generate face encoding (reads JSON from stdin with 'image' field)")
        print("  compare - Compare two encodings (reads JSON from stdin with 'encoding1' and 'encoding2' fields)")
        sys.exit(1)
    
    command = sys.argv[1]
    
    # Read input data from stdin
    try:
        input_data = json.load(sys.stdin)
    except Exception as e:
        print(json.dumps({'success': False, 'error': f'Failed to read input: {str(e)}'}))
        sys.exit(1)
    
    if command == 'encode':
        if 'image' not in input_data:
            print(json.dumps({'success': False, 'error': 'Missing image field in input'}))
            sys.exit(1)
        result = generate_face_encoding(input_data['image'])
        print(json.dumps(result))
    elif command == 'compare':
        if 'encoding1' not in input_data or 'encoding2' not in input_data:
            print(json.dumps({'success': False, 'error': 'Missing encoding1 or encoding2 in input'}))
            sys.exit(1)
        
        # Optional tolerance parameter
        tolerance = input_data.get('tolerance', 0.5)
        result = compare_faces(input_data['encoding1'], input_data['encoding2'], tolerance)
        print(json.dumps(result))
    else:
        print(json.dumps({'success': False, 'error': 'Invalid command'}))
        sys.exit(1)
