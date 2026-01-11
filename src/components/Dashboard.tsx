
import React, { useEffect, useState } from 'react';
import { Artwork, User } from '../types/types';
import { getUserArtworks, deleteArtwork } from '../services/artworkService';
import { Button } from './Button';
import { Plus, Trash2 } from 'lucide-react';

interface DashboardProps {
  user: User;
  onSelectArtwork: (artwork: Artwork) => void;
  onNewArtwork: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ user, onSelectArtwork, onNewArtwork }) => {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const arts = await getUserArtworks();
        setArtworks(arts);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
        setArtworks([]);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleDelete = async (artworkId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this artwork?')) return;

    try {
      await deleteArtwork(artworkId);
      setArtworks(artworks.filter(a => a.id !== artworkId));
    } catch (err) {
      console.error("Failed to delete artwork", err);
      alert('Failed to delete artwork. Please try again.');
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-stone-400">Loading collection...</div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-16 border-b border-stone-100 pb-8">
        <div>
          <h1 className="font-serif text-4xl text-stone-900 mb-2">My Collection</h1>
          <p className="text-stone-500 font-light">Welcome back, {user.name}. You have {artworks.length} saved masterpieces.</p>
        </div>
        <Button onClick={onNewArtwork} className="group">
          <Plus size={18} className="mr-2" />
          Add New Artwork
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* LEFT COL: ARTWORK GRID */}
        <div className="lg:col-span-2 space-y-8">
          <h2 className="text-xs font-bold uppercase tracking-widest text-stone-400">Saved Artworks</h2>
          
          {artworks.length === 0 ? (
            <div className="bg-white border-2 border-dashed border-stone-200 rounded-sm p-12 text-center">
              <p className="text-stone-500 mb-4">Your gallery is empty.</p>
              <Button variant="outline" onClick={onNewArtwork}>Create your first print</Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {artworks.map((art) => (
                <div
                  key={art.id}
                  className="group bg-white p-4 shadow-sm hover:shadow-xl transition-all duration-300 border border-stone-100 cursor-pointer relative"
                  onClick={() => onSelectArtwork(art)}
                >
                  <button
                    onClick={(e) => handleDelete(art.id, e)}
                    className="absolute top-2 right-2 z-10 bg-white/90 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 hover:text-red-600"
                    title="Delete artwork"
                  >
                    <Trash2 size={16} />
                  </button>
                  <div className="aspect-square bg-stone-50 mb-4 overflow-hidden relative">
                    <img
                      src={art.thumbnailUrl || art.processedUrl}
                      className="w-full h-full object-contain p-4 group-hover:scale-105 transition-transform duration-500"
                      style={{ mixBlendMode: art.style === ArtStyle.DUOTONE ? 'normal' : 'multiply' }}
                      alt={art.title}
                    />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/5 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="bg-white text-stone-900 px-4 py-2 text-xs font-bold uppercase tracking-widest shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-transform">
                        View
                      </span>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-serif text-lg text-stone-900 truncate">{art.title || art.subject}</h3>
                    <div className="flex justify-between items-center mt-1">
                      <p className="text-xs text-stone-500 uppercase tracking-wider">{art.medium} • {new Date(art.createdAt).toLocaleDateString()}</p>
                      <span className="text-[10px] border border-stone-200 px-2 py-0.5 rounded-full text-stone-400">
                        {art.style}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COL: ACCOUNT INFO */}
        <div className="space-y-8">
          
          {/* Account Summary */}
          <div className="bg-stone-900 text-stone-400 p-8 rounded-sm mt-12">
            <h3 className="text-white font-serif text-xl mb-4">Account Details</h3>
            <div className="space-y-2 text-sm font-light mb-6">
              <p>Name: <span className="text-stone-200">{user.name}</span></p>
              <p>Email: <span className="text-stone-200">{user.email}</span></p>
            </div>
            <button className="text-xs uppercase tracking-widest text-white border-b border-white/20 pb-1 hover:border-white transition-colors">
              Manage Subscription
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
