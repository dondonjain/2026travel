export interface Location {
  id?: string; // Firebase doc ID
  day: string;
  title: string;
  jp: string;
  cat: string;
  lat: number;
  lng: number;
  note: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userPhoto?: string;
  text: string;
  photoUrl?: string;
  timestamp: any; // Firebase Timestamp or Date
}
