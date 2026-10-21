/**
 * Data katalog "Jasa Kami" (jasa). Dipakai oleh migrasi 0005 untuk
 * mengisi tabel `jasa` secara idempoten (berdasarkan `slug`).
 */
export interface SeedJasa {
  slug: string;
  title: { id: string; en: string };
  price: string;
  description: { id: string; en: string };
  features: { id: string; en: string }[];
}

export const SEED_JASA: SeedJasa[] = [
  {
    slug: 'landing-page',
    title: { id: 'Landing Page', en: 'Landing Page' },
    price: '500000',
    description: {
      id: 'Website satu halaman yang modern untuk promosi bisnis, produk, atau personal branding',
      en: 'A modern single-page website for business, product promotion, or personal branding',
    },
    features: [
      { id: 'Desain modern, profesional, dan responsif', en: 'Modern, professional, and responsive design' },
      { id: 'Tampilan optimal di HP, tablet, dan desktop', en: 'Optimized for mobile, tablet, and desktop' },
      { id: 'Struktur halaman yang menarik', en: 'Engaging page structure' },
      { id: 'Bagian hero, layanan, keunggulan, dan kontak', en: 'Hero, services, benefits, and contact sections' },
      { id: 'Tombol WhatsApp untuk menghubungi bisnis', en: 'WhatsApp contact button' },
      { id: 'Animasi dan interaksi sederhana', en: 'Simple animations and interactions' },
      { id: 'Optimasi dasar SEO dan performa', en: 'Basic SEO and performance optimization' },
      { id: 'Revisi ringan GRATIS', en: 'Free minor revisions' },
      { id: 'Deploy website ke hosting yang tersedia', en: 'Website deployment to available hosting' },
    ],
  },
  {
    slug: 'website-tugas-kampus',
    title: { id: 'Website Tugas Kampus', en: 'College Project Website' },
    price: '1000000',
    description: {
      id: 'Website untuk proyek pembelajaran, tugas kuliah, dan demonstrasi sistem',
      en: 'Websites for learning projects, college assignments, and system demonstrations',
    },
    features: [
      { id: 'Desain sesuai tema dan kebutuhan proyek', en: 'Design based on project requirements' },
      { id: 'HTML, CSS, JavaScript, atau framework sesuai kebutuhan', en: 'HTML, CSS, JavaScript, or a suitable framework' },
      { id: 'Fitur CRUD sederhana jika diperlukan', en: 'Basic CRUD functionality if needed' },
      { id: 'Integrasi database untuk paket yang disepakati', en: 'Database integration within the agreed scope' },
      { id: 'Formulir dan validasi input', en: 'Forms and input validation' },
      { id: 'Tampilan responsif untuk berbagai perangkat', en: 'Responsive layout across devices' },
      { id: 'Source code dan petunjuk instalasi', en: 'Source code and setup instructions' },
      { id: 'Bantuan penjelasan alur kode dasar', en: 'Basic code walkthrough and explanation' },
      { id: 'Revisi ringan GRATIS', en: 'Free minor revisions' },
    ],
  },
  {
    slug: 'website-kompleks',
    title: { id: 'Website Kompleks', en: 'Complex Web Application' },
    price: '2000000',
    description: {
      id: 'Website dinamis dengan backend, database, autentikasi, dan dashboard sesuai kebutuhan bisnis',
      en: 'A dynamic website with backend, database, authentication, and dashboards tailored to business needs',
    },
    features: [
      { id: 'UI/UX modern dan responsif', en: 'Modern and responsive UI/UX' },
      { id: 'Frontend dan backend terintegrasi', en: 'Integrated frontend and backend' },
      { id: 'Database relasional atau NoSQL', en: 'Relational or NoSQL database' },
      { id: 'Login, registrasi, dan hak akses pengguna', en: 'Login, registration, and user roles' },
      { id: 'Dashboard admin dan manajemen data', en: 'Admin dashboard and data management' },
      { id: 'REST API sesuai kebutuhan', en: 'REST API tailored to requirements' },
      { id: 'Fitur pencarian, filter, dan CRUD', en: 'Search, filtering, and CRUD features' },
      { id: 'Keamanan dasar dan validasi data', en: 'Basic security and data validation' },
      { id: 'Deployment dan konfigurasi lingkungan', en: 'Deployment and environment configuration' },
      { id: 'Dokumentasi serta support awal', en: 'Documentation and initial support' },
    ],
  },
  {
    slug: 'aplikasi-mobile',
    title: { id: 'Aplikasi Mobile', en: 'Mobile Application' },
    price: '3000000',
    description: {
      id: 'Aplikasi mobile modern untuk Android dengan fitur sesuai kebutuhan pengguna',
      en: 'A modern Android mobile application with features tailored to user needs',
    },
    features: [
      { id: 'Desain UI/UX modern dan responsif', en: 'Modern mobile UI/UX design' },
      { id: 'Pengembangan menggunakan Flutter atau teknologi yang disepakati', en: 'Development using Flutter or an agreed technology' },
      { id: 'Navigasi dan beberapa layar aplikasi', en: 'App navigation and multiple screens' },
      { id: 'Integrasi REST API dan backend jika diperlukan', en: 'REST API and backend integration if needed' },
      { id: 'Integrasi database sesuai kebutuhan', en: 'Database integration as required' },
      { id: 'Login dan autentikasi pengguna sesuai scope', en: 'User login and authentication within scope' },
      { id: 'Formulir, validasi, dan pengelolaan data', en: 'Forms, validation, and data management' },
      { id: 'Pengujian fungsi dasar aplikasi', en: 'Basic application functionality testing' },
      { id: 'Source code dan panduan instalasi', en: 'Source code and installation guide' },
      { id: 'Support awal setelah penyerahan', en: 'Initial support after delivery' },
    ],
  },
];
