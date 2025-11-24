-- Check if Student records have names populated
SELECT id, name, email, registrationNumber, userId 
FROM "Student" 
LIMIT 10;

-- Check if there are any students without names
SELECT COUNT(*) as students_without_names
FROM "Student"
WHERE name IS NULL OR name = '';

-- If you need to populate student names from their linked User accounts:
UPDATE "Student" s
SET name = u.name
FROM "User" u
WHERE s."userId" = u.id
  AND (s.name IS NULL OR s.name = '');

-- Verify the update worked
SELECT s.id, s.name as student_name, u.name as user_name, s.email
FROM "Student" s
LEFT JOIN "User" u ON s."userId" = u.id
LIMIT 10;
