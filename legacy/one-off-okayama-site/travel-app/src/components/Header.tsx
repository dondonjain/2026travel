import { LogIn, LogOut } from 'lucide-react';
import { auth, googleProvider } from '../lib/firebase';
import { signInWithPopup, signOut } from 'firebase/auth';

interface HeaderProps {
  user: any;
}

export function Header({ user }: HeaderProps) {
  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error("Login failed:", error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
  };

  return (
    <header className="bg-gradient-to-br from-[#2b5c8f] to-[#1e4267] text-white p-6 shadow-md">
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">2026 夏遊岡山・四國・山陰 7日自駕之旅</h1>
          <p className="text-sm opacity-90">岡山・倉敷・尾道・廣島・宮島・松江・出雲・鳥取自駕探索地圖指南</p>
        </div>
        
        <div>
          {user ? (
            <div className="flex items-center gap-3">
              <img src={user.photoURL} alt={user.displayName} className="w-8 h-8 rounded-full border-2 border-white" />
              <span className="text-sm font-medium">{user.displayName}</span>
              <button 
                onClick={handleLogout}
                className="flex items-center gap-1 bg-white/10 hover:bg-white/20 transition-colors px-3 py-1.5 rounded-full text-sm"
              >
                <LogOut size={16} /> 登出
              </button>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="flex items-center gap-2 bg-white text-[#2b5c8f] hover:bg-gray-100 transition-colors px-4 py-2 rounded-full text-sm font-bold shadow-sm"
            >
              <LogIn size={16} /> Google 登入
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
