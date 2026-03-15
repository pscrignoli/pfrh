
-- Make hr_documents bucket private
UPDATE storage.buckets SET public = false WHERE id = 'hr_documents';
