-- Allow PowerPoint uploads in the lectures bucket
update storage.buckets
set allowed_mime_types = array[
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/x-m4a',
  'text/plain',
  'application/octet-stream'
]
where id = 'lectures';
