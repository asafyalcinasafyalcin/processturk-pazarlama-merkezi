import { Suspense } from 'react';
import GirisForm from './GirisForm';

export const metadata = { title: 'Giriş · Pazarlama Komuta Merkezi' };

export default function GirisPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Suspense fallback={null}>
        <GirisForm />
      </Suspense>
    </div>
  );
}
