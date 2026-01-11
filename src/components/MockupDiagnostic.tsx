import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { cloudinaryService } from '../services/cloudinaryService';
import { CheckCircle2, XCircle, Upload } from 'lucide-react';
import { Button } from './Button';

interface MockupTemplate {
  id: string;
  name: string;
  product_type: string;
  cloudinary_public_id: string;
  placement_config: any;
  is_active: boolean;
}

interface TemplateStatus {
  template: MockupTemplate;
  imageExists: boolean;
  testUrl: string;
}

export function MockupDiagnostic() {
  const [templates, setTemplates] = useState<TemplateStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState<string | null>(null);

  useEffect(() => {
    loadAndTestTemplates();
  }, []);

  async function loadAndTestTemplates() {
    try {
      const { data, error } = await supabase
        .from('mockup_templates')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;

      const statusPromises = (data || []).map(async (template) => {
        const testUrl = cloudinaryService.getOptimizedUrl(template.cloudinary_public_id, 400);

        const imageExists = await new Promise<boolean>((resolve) => {
          const img = new Image();
          img.onload = () => resolve(true);
          img.onerror = () => resolve(false);
          img.src = testUrl;
          setTimeout(() => resolve(false), 5000);
        });

        return {
          template,
          imageExists,
          testUrl,
        };
      });

      const statuses = await Promise.all(statusPromises);
      setTemplates(statuses);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleFileUpload(templateId: string, file: File) {
    setUploading(templateId);
    try {
      const uploadResult = await cloudinaryService.uploadArtwork(file, `mockup_${Date.now()}`);

      const { error } = await supabase
        .from('mockup_templates')
        .update({ cloudinary_public_id: uploadResult.public_id })
        .eq('id', templateId);

      if (error) throw error;

      alert('Mockup template uploaded successfully!');
      loadAndTestTemplates();
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Failed to upload mockup template');
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-8">
        <div className="text-center">Loading mockup templates...</div>
      </div>
    );
  }

  const workingCount = templates.filter(t => t.imageExists).length;
  const totalCount = templates.length;

  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-2">Mockup Template Diagnostic</h1>
      <p className="text-gray-600 mb-8">
        {workingCount} of {totalCount} mockup templates are working correctly
      </p>

      <div className="space-y-4">
        {templates.map(({ template, imageExists, testUrl }) => (
          <div
            key={template.id}
            className={`border rounded-lg p-6 ${
              imageExists ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                {imageExists ? (
                  <CheckCircle2 className="w-6 h-6 text-green-600 flex-shrink-0 mt-1" />
                ) : (
                  <XCircle className="w-6 h-6 text-red-600 flex-shrink-0 mt-1" />
                )}
                <div>
                  <h3 className="font-bold text-lg">{template.name}</h3>
                  <p className="text-sm text-gray-600">Type: {template.product_type}</p>
                  <p className="text-xs text-gray-500 font-mono mt-1 break-all">
                    {template.cloudinary_public_id}
                  </p>
                </div>
              </div>

              <span
                className={`px-3 py-1 rounded-full text-sm font-medium ${
                  imageExists
                    ? 'bg-green-100 text-green-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {imageExists ? 'Working' : 'Missing'}
              </span>
            </div>

            {imageExists ? (
              <div className="mt-4">
                <img
                  src={testUrl}
                  alt={template.name}
                  className="w-full max-w-md rounded-lg shadow-md"
                />
              </div>
            ) : (
              <div className="mt-4">
                <div className="bg-white rounded-lg p-4 border border-red-300">
                  <p className="text-sm text-red-700 mb-3">
                    This mockup template image doesn't exist in Cloudinary. Upload a mockup image to fix this:
                  </p>
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileUpload(template.id, file);
                      }}
                      className="flex-1 text-sm"
                      disabled={uploading === template.id}
                    />
                    {uploading === template.id && (
                      <span className="text-sm text-gray-600">Uploading...</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Try using: large framed rainbow.png, Cup indoors.png, dragon tote 1.png, or Phone.png from your public folder
                  </p>
                </div>
              </div>
            )}

            <div className="mt-4 text-xs text-gray-500">
              <strong>Placement Config:</strong>
              <pre className="mt-1 bg-white p-2 rounded overflow-x-auto">
{JSON.stringify(template.placement_config, null, 2)}
              </pre>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h2 className="font-bold text-blue-900 mb-3">How to Fix Missing Templates:</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
          <li>Use the file upload buttons above to upload mockup images from your computer</li>
          <li>Choose images from your /public folder like "large framed rainbow.png", "Cup indoors.png", etc.</li>
          <li>The images will be uploaded to Cloudinary and the database will be updated automatically</li>
          <li>Refresh this page to see the updated status</li>
        </ol>
      </div>
    </div>
  );
}
