import { useState, useEffect } from 'react';
import { X, Image as ImageIcon, Send } from 'lucide-react';
import type { Location, Review } from '../types';
import { db, storage } from '../lib/firebase';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

interface ReviewModalProps {
  location: Location | null;
  onClose: () => void;
  user: any;
}

export function ReviewModal({ location, onClose, user }: ReviewModalProps) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [newText, setNewText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!location?.id) return;
    
    // Default to the locations collection
    const reviewsRef = collection(db, 'locations', location.id, 'reviews');
    const q = query(reviewsRef, orderBy('timestamp', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const revs: Review[] = [];
      snapshot.forEach((doc) => {
        revs.push({ id: doc.id, ...doc.data() } as Review);
      });
      setReviews(revs);
    });

    return () => unsubscribe();
  }, [location]);

  if (!location) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return alert("請先登入");
    if (!newText.trim() && !file) return;
    if (!location.id) return alert("無法留言，請先執行資料轉移");

    setUploading(true);
    try {
      let photoUrl = '';
      if (file) {
        // Compress the image before uploading
        const options = {
          maxSizeMB: 0.5, // 500KB
          maxWidthOrHeight: 1920,
          useWebWorker: true
        };
        const compressedFile = await imageCompression(file, options);
        
        const fileRef = ref(storage, `reviews/${location.id}/${Date.now()}_${compressedFile.name}`);
        const uploadTask = await uploadBytesResumable(fileRef, compressedFile);
        photoUrl = await getDownloadURL(uploadTask.ref);
      }

      const reviewsRef = collection(db, 'locations', location.id, 'reviews');
      await addDoc(reviewsRef, {
        userId: user.uid,
        userName: user.displayName,
        userPhoto: user.photoURL,
        text: newText,
        photoUrl,
        timestamp: serverTimestamp()
      });

      setNewText('');
      setFile(null);
    } catch (err) {
      console.error("Upload error", err);
      alert("上傳失敗");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-gray-50">
          <div>
            <h2 className="text-xl font-bold text-gray-800">{location.title}</h2>
            <p className="text-sm text-gray-500">{location.jp}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
            <X size={24} className="text-gray-500" />
          </button>
        </div>

        {/* Reviews List */}
        <div className="flex-1 overflow-y-auto p-6 bg-gray-50/50">
          {reviews.length === 0 ? (
            <div className="text-center text-gray-400 py-10">
              <ImageIcon size={48} className="mx-auto mb-3 opacity-20" />
              <p>還沒有人分享照片或心得，來搶頭香吧！</p>
            </div>
          ) : (
            <div className="space-y-6">
              {reviews.map(review => (
                <div key={review.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={review.userPhoto || 'https://via.placeholder.com/40'} alt="user" className="w-10 h-10 rounded-full" />
                    <div>
                      <div className="font-bold text-sm">{review.userName}</div>
                      <div className="text-xs text-gray-400">
                        {review.timestamp?.toDate ? review.timestamp.toDate().toLocaleString() : '剛剛'}
                      </div>
                    </div>
                  </div>
                  {review.text && <p className="text-gray-700 text-sm mb-3 whitespace-pre-wrap">{review.text}</p>}
                  {review.photoUrl && (
                    <div className="rounded-lg overflow-hidden border border-gray-100 bg-gray-50">
                      <img src={review.photoUrl} alt="review" className="w-full h-auto max-h-96 object-contain" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Input Form */}
        <div className="p-5 border-t border-gray-100 bg-white">
          {!user ? (
            <div className="text-center p-4 bg-blue-50 rounded-lg text-blue-800 text-sm">
              請先點擊右上角「Google 登入」才能上傳照片與心得
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <textarea 
                value={newText}
                onChange={(e) => setNewText(e.target.value)}
                placeholder="分享你的心得或評論..."
                className="w-full border border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#2b5c8f] resize-none h-20"
              />
              <div className="flex justify-between items-center">
                <label className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full cursor-pointer transition-colors text-sm font-medium">
                  <ImageIcon size={18} />
                  {file ? file.name : "選擇照片"}
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    className="hidden" 
                  />
                </label>
                <button 
                  type="submit" 
                  disabled={uploading || (!newText.trim() && !file)}
                  className="flex items-center gap-2 bg-[#e06d53] hover:bg-[#c95d45] disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-6 py-2 rounded-full font-bold transition-colors shadow-sm text-sm"
                >
                  {uploading ? '上傳中...' : '發佈分享'}
                  {!uploading && <Send size={16} />}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
