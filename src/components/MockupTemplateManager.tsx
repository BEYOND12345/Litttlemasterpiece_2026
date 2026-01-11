import { useState, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import { cloudinaryService } from '../services/cloudinaryService';
import { Upload, Trash2, Save } from 'lucide-react';
import { Button } from './Button';

interface MockupTemplate {
  id: string;
  name: string;
  product_type: string;
  cloudinary_public_id: string;
  placement_config: {
    width?: string;
    height?: string;
    gravity?: string;
    rotation?: number;
  };
  is_active: boolean;
  display_order: number;
}

export function MockupTemplateManager() {
  const [templates, setTemplates] = useState<MockupTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [newTemplate, setNewTemplate] = useState({
    name: '',
    product_type: 'frame',
    width: '70%',
    height: '70%',
    gravity: 'center',
    rotation: 0,
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('mockup_templates')
        .select('*')
        .order('display_order');

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleUpload() {
    if (!selectedFile) {
      alert('Please select an image file');
      return;
    }

    if (!newTemplate.name) {
      alert('Please enter a template name');
      return;
    }

    setUploading(true);
    try {
      const mockupId = crypto.randomUUID();
      const uploadResult = await cloudinaryService.uploadArtwork(selectedFile, `mockup_${mockupId}`);

      const { error } = await supabase.from('mockup_templates').insert({
        name: newTemplate.name,
        product_type: newTemplate.product_type,
        cloudinary_public_id: uploadResult.public_id,
        placement_config: {
          width: newTemplate.width,
          height: newTemplate.height,
          gravity: newTemplate.gravity,
          rotation: newTemplate.rotation || undefined,
        },
        is_active: true,
        display_order: templates.length,
      });

      if (error) throw error;

      alert('Mockup template uploaded successfully!');
      setSelectedFile(null);
      setNewTemplate({
        name: '',
        product_type: 'frame',
        width: '70%',
        height: '70%',
        gravity: 'center',
        rotation: 0,
      });
      loadTemplates();
    } catch (error) {
      console.error('Error uploading mockup:', error);
      alert('Failed to upload mockup template');
    } finally {
      setUploading(false);
    }
  }

  async function deleteTemplate(id: string) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      const { error } = await supabase
        .from('mockup_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      alert('Failed to delete template');
    }
  }

  async function updatePlacementConfig(id: string, template: MockupTemplate) {
    try {
      const { error } = await supabase
        .from('mockup_templates')
        .update({
          placement_config: template.placement_config,
        })
        .eq('id', id);

      if (error) throw error;
      alert('Placement config updated!');
      loadTemplates();
    } catch (error) {
      console.error('Error updating template:', error);
      alert('Failed to update template');
    }
  }

  if (loading) {
    return <div className="p-8">Loading templates...</div>;
  }

  return (
    <div className="max-w-6xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-8">Mockup Template Manager</h1>

      <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
        <h2 className="text-xl font-bold mb-4">Upload New Mockup Template</h2>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-2">Template Name</label>
            <input
              type="text"
              value={newTemplate.name}
              onChange={(e) => setNewTemplate({ ...newTemplate, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., Framed Art on Wall"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Product Type</label>
            <select
              value={newTemplate.product_type}
              onChange={(e) => setNewTemplate({ ...newTemplate, product_type: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="frame">Frame</option>
              <option value="canvas">Canvas</option>
              <option value="mug">Mug</option>
              <option value="tote">Tote Bag</option>
              <option value="tshirt">T-Shirt</option>
              <option value="phone">Phone Case</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Width (%)</label>
            <input
              type="text"
              value={newTemplate.width}
              onChange={(e) => setNewTemplate({ ...newTemplate, width: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., 70%"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Height (%)</label>
            <input
              type="text"
              value={newTemplate.height}
              onChange={(e) => setNewTemplate({ ...newTemplate, height: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="e.g., 70%"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Gravity</label>
            <select
              value={newTemplate.gravity}
              onChange={(e) => setNewTemplate({ ...newTemplate, gravity: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="center">Center</option>
              <option value="north">Top</option>
              <option value="south">Bottom</option>
              <option value="east">Right</option>
              <option value="west">Left</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Rotation (degrees)</label>
            <input
              type="number"
              value={newTemplate.rotation}
              onChange={(e) => setNewTemplate({ ...newTemplate, rotation: parseInt(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="0"
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-2">Mockup Image</label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="w-full"
          />
          {selectedFile && (
            <p className="text-sm text-gray-600 mt-2">Selected: {selectedFile.name}</p>
          )}
        </div>

        <Button
          onClick={handleUpload}
          disabled={uploading || !selectedFile}
          className="flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {uploading ? 'Uploading...' : 'Upload Template'}
        </Button>
      </div>

      <div className="bg-white rounded-lg shadow-lg p-6">
        <h2 className="text-xl font-bold mb-4">Existing Templates</h2>

        <div className="space-y-4">
          {templates.map((template) => (
            <div key={template.id} className="border rounded-lg p-4">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="font-bold">{template.name}</h3>
                  <p className="text-sm text-gray-600">Type: {template.product_type}</p>
                  <p className="text-sm text-gray-600">ID: {template.cloudinary_public_id}</p>
                </div>
                <button
                  onClick={() => deleteTemplate(template.id)}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1">Width</label>
                  <input
                    type="text"
                    value={template.placement_config.width || ''}
                    onChange={(e) => {
                      const updated = {
                        ...template,
                        placement_config: {
                          ...template.placement_config,
                          width: e.target.value,
                        },
                      };
                      setTemplates(templates.map(t => t.id === template.id ? updated : t));
                    }}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Height</label>
                  <input
                    type="text"
                    value={template.placement_config.height || ''}
                    onChange={(e) => {
                      const updated = {
                        ...template,
                        placement_config: {
                          ...template.placement_config,
                          height: e.target.value,
                        },
                      };
                      setTemplates(templates.map(t => t.id === template.id ? updated : t));
                    }}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Gravity</label>
                  <select
                    value={template.placement_config.gravity || 'center'}
                    onChange={(e) => {
                      const updated = {
                        ...template,
                        placement_config: {
                          ...template.placement_config,
                          gravity: e.target.value,
                        },
                      };
                      setTemplates(templates.map(t => t.id === template.id ? updated : t));
                    }}
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="center">Center</option>
                    <option value="north">Top</option>
                    <option value="south">Bottom</option>
                  </select>
                </div>

                <div className="flex items-end">
                  <Button
                    onClick={() => updatePlacementConfig(template.id, template)}
                    className="flex items-center gap-1 text-sm px-3 py-1"
                  >
                    <Save className="w-3 h-3" />
                    Save
                  </Button>
                </div>
              </div>

              <div className="mt-3">
                <img
                  src={cloudinaryService.getOptimizedUrl(template.cloudinary_public_id, 300)}
                  alt={template.name}
                  className="w-full max-w-xs rounded-lg"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="200"><rect fill="%23ddd" width="300" height="200"/><text x="50%" y="50%" text-anchor="middle" fill="%23999">Image not found</text></svg>';
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
