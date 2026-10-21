import { SEED_JASA } from './jasa.seed';
import { SEED_PROJECTS } from './projects.seed';

/**
 * Knowledge base untuk Bot JasaHUB.
 *
 * Semua jawaban BOT diambil dari tabel `chat_knowledge` (retrieval sederhana
 * berbasis PostgreSQL full-text search + trigram + kecocokan kata kunci).
 * Tidak ada data sensitif (akun admin, kredensial, data pelanggan lain,
 * isi database) yang boleh masuk ke file ini.
 *
 * Isi knowledge dibangun dari konten halaman pelanggan:
 *  - Tentang JasaHub (About)
 *  - Katalog jasa & paket harga (tabel `jasa`)
 *  - Portofolio project (tabel `projects`)
 *  - Alur pemesanan, pembayaran, revisi, kontak, dan akun pelanggan
 */

export interface ChatKnowledgeSeed {
  category: string;
  question: string;
  answer: string;
  keywords: string[];
  lang: 'id' | 'en';
}

const rows: ChatKnowledgeSeed[] = [];
const seen = new Set<string>();

function add(
  category: string,
  question: string,
  answer: string,
  keywords: string[] = [],
): void {
  const q = question.replace(/\s+/g, ' ').trim();
  const key = q.toLowerCase();
  if (!q || seen.has(key)) return;
  seen.add(key);
  rows.push({
    category,
    question: q,
    answer: answer.replace(/\s+/g, ' ').trim(),
    keywords: Array.from(new Set(keywords.map((k) => k.toLowerCase()))),
    lang: 'id',
  });
}

const rupiah = (value: string): string =>
  `Rp ${Number(value || 0).toLocaleString('id-ID')}`;

// ---------------------------------------------------------------------------
// 1. Tentang JasaHub
// ---------------------------------------------------------------------------
interface Topic {
  q: string[];
  a: string;
  k?: string[];
}

const aboutTopics: Topic[] = [
  {
    q: [
      'Apa itu JasaHub?',
      'JasaHub itu apa ya?',
      'Bisa jelaskan tentang JasaHub?',
      'JasaHub bergerak di bidang apa?',
      'Tentang JasaHub dong',
    ],
    a: 'JasaHub adalah layanan kreatif digital yang berfokus pada pembuatan website profesional, dari Landing Page, Website Tugas Kampus, Website Kompleks, hingga Aplikasi Mobile. JasaHub lahir dari semangat kolaborasi, inovasi, dan keinginan menghadirkan hasil yang berdampak. Semua pengerjaan dilakukan dengan sentuhan kreativitas dan fokus pada kebutuhan pelanggan.',
    k: ['tentang', 'jasahub', 'profil', 'layanan'],
  },
  {
    q: [
      'Siapa pemilik JasaHub?',
      'Siapa yang membuat JasaHub?',
      'Siapa developer JasaHub?',
      'JasaHub milik siapa?',
    ],
    a: 'JasaHub dibuat dan dikelola oleh Baihaqie Ar Rafi. Website ini juga menjadi portofolio beliau untuk menunjukkan hasil karya di bidang desain dan pengembangan website.',
    k: ['pemilik', 'developer', 'baihaqie', 'jasa'],
  },
  {
    q: [
      'JasaHub berlokasi di mana?',
      'Alamat JasaHub di mana?',
      'Apakah JasaHub melayani seluruh Indonesia?',
      'Bisa kerja sama jarak jauh?',
    ],
    a: 'JasaHub berbasis di Medan, Sumatera Utara, dan dapat bekerja sama secara online untuk pelanggan dari mana saja. Komunikasi, konsultasi, dan pengiriman hasil dilakukan secara daring sehingga tidak terbatas lokasi.',
    k: ['lokasi', 'alamat', 'medan', 'online', 'remote'],
  },
  {
    q: [
      'Layanan apa saja yang tersedia di JasaHub?',
      'JasaHub menyediakan jasa apa saja?',
      'Apa saja layanan JasaHub?',
      'Bisa pesan apa di JasaHub?',
    ],
    a: 'Jasa yang tersedia di katalog JasaHub ada 4 paket: Landing Page (Rp 500.000), Website Tugas Kampus (Rp 1.000.000), Website Kompleks (Rp 2.000.000), dan Aplikasi Mobile (Rp 3.000.000). Detail paket, harga, dan fitur bisa dilihat pada bagian "Jasa Kami" di halaman utama.',
    k: ['layanan', 'jasa', 'paket', 'katalog', 'website'],
  },
  {
    q: [
      'Kenapa harus memilih JasaHub?',
      'Apa keunggulan JasaHub dibanding yang lain?',
      'Apa alasan memakai JasaHub?',
      'Keunggulan JasaHub apa saja?',
    ],
    a: 'Keunggulan JasaHub adalah pengerjaan rapi dan cepat, komunikasi langsung dengan pengerja, harga terjangkau, desain menyesuaikan kebutuhan, serta adanya revisi ringan gratis. Hasil akhir disesuaikan dengan tujuan bisnis atau personal branding kamu.',
    k: ['keunggulan', 'alasan', 'pilih', 'unggul'],
  },
  {
    q: [
      'Bagaimana cara kerja JasaHub?',
      'Alur kerja JasaHub seperti apa?',
      'Proses pengerjaan di JasaHub gimana?',
      'Langkah-langkah kerja sama dengan JasaHub?',
    ],
    a: 'Alurnya: konsultasi kebutuhan, penentuan paket dan harga, pengumpulan materi, pengerjaan, revisi ringan, lalu penyerahan hasil. Semua tahap dikomunikasikan agar hasil sesuai harapan sebelum diserahkan.',
    k: ['cara kerja', 'alur', 'proses', 'tahapan'],
  },
  {
    q: [
      'Jam berapa admin JasaHub online?',
      'Apakah JasaHub buka 24 jam?',
      'Kapan admin bisa dihubungi?',
      'Jam operasional JasaHub?',
    ],
    a: 'Admin JasaHub tidak selalu online 24 jam. Kamu bisa mengirim pertanyaan kapan saja lewat chat bot ini atau formulir pesanan; pesanmu akan ditindaklanjuti admin pada jam kerja. Untuk kebutuhan mendesak, sebutkan "urgent" di pesanmu.',
    k: ['jam', 'online', 'operasional', 'admin'],
  },
  {
    q: [
      'Apakah JasaHub menerima proyek custom?',
      'Bisa request kebutuhan khusus?',
      'Apakah bisa pesan di luar paket?',
      'Bisa custom fitur?',
    ],
    a: 'Bisa. Paket yang tertera adalah acuan dasar; kebutuhan khusus seperti fitur tambahan, jumlah halaman, integrasi, atau desain tertentu dapat didiskusikan dengan admin dan akan disesuaikan penawarannya.',
    k: ['custom', 'khusus', 'request', 'fitur'],
  },
  {
    q: [
      'Bagaimana cara menghubungi JasaHub?',
      'Kontak JasaHub di mana?',
      'Nomor WhatsApp JasaHub berapa?',
      'Email JasaHub apa?',
    ],
    a: 'Kamu bisa menghubungi JasaHub melalui formulir pemesanan di halaman Jasa Kami, formulir kontak di halaman Kontak, atau chat bot ini. Admin akan menghubungi kamu kembali melalui WhatsApp untuk diskusi lanjutan.',
    k: ['kontak', 'whatsapp', 'email', 'hubungi'],
  },
  {
    q: [
      'Apakah ada konsultasi gratis?',
      'Bisa tanya-tanya dulu sebelum pesan?',
      'Konsultasi dulu boleh?',
      'Apakah harus langsung pesan?',
    ],
    a: 'Boleh banget. Kamu bisa konsultasi gratis terlebih dahulu untuk membahas kebutuhan, referensi, estimasi biaya, dan waktu pengerjaan. Setelah cocok, barulah pesanan diproses.',
    k: ['konsultasi', 'gratis', 'tanya', 'diskusi'],
  },
  {
    q: [
      'Apakah JasaHub menerima revisi?',
      'Bisa revisi berapa kali?',
      'Revisi desain bisa tidak?',
      'Bagaimana kebijakan revisi?',
    ],
    a: 'Revisi ringan gratis sampai hasil sesuai kesepakatan. Jumlah dan cakupan revisi mengikuti kesepakatan awal. Revisi besar atau penambahan fitur di luar kesepakatan dapat dikenakan biaya tambahan.',
    k: ['revisi', 'perbaikan', 'ubah', 'desain'],
  },
  {
    q: [
      'Apakah ada garansi?',
      'Bagaimana kalau ada bug setelah selesai?',
      'Apakah hasil dijamin?',
      'Apakah hasil bergaransi?',
      'Garansi pengerjaan bagaimana?',
      'Ada jaminan hasil?',
      'Kalau error setelah jadi bagaimana?',
    ],
    a: 'Untuk website dan aplikasi, JasaHub memberikan masa support awal untuk perbaikan bug atau kendala teknis yang muncul dari pekerjaan kami. Kerusakan akibat perubahan dari pihak lain atau kelalaian pengguna di luar cakupan garansi.',
    k: ['garansi', 'jaminan', 'bug', 'error', 'support'],
  },
  {
    q: [
      'Bagaimana kebijakan privasi data pelanggan?',
      'Apakah data saya aman?',
      'Apakah materi saya dirahasiakan?',
      'Bisa jaga kerahasiaan proyek?',
    ],
    a: 'Data dan materi yang kamu berikan hanya digunakan untuk keperluan pengerjaan proyek. JasaHub tidak membagikan data pelanggan kepada pihak lain tanpa izin. Untuk kebutuhan NDA atau kerahasiaan khusus, silakan diskusikan dengan admin.',
    k: ['privasi', 'aman', 'rahasia', 'data'],
  },
  {
    q: [
      'Apakah JasaHub punya portofolio?',
      'Bisa lihat contoh hasil kerja?',
      'Contoh project JasaHub apa saja?',
      'Portofolio JasaHub di mana?',
    ],
    a: 'Portofolio JasaHub ditampilkan pada bagian Tentang di halaman utama, berupa cincin project dan daftar karya. Kamu bisa melihat contoh seperti Racik Kopi, Futsal Terminal, Klinik Mariana, dan project lainnya.',
    k: ['portofolio', 'contoh', 'project', 'karya'],
  },
  {
    q: [
      'Tools apa yang dipakai JasaHub?',
      'Software desain JasaHub apa?',
      'Teknologi yang dipakai JasaHub?',
      'Stack JasaHub apa saja?',
    ],
    a: 'Untuk desain, JasaHub menggunakan Canva. Untuk website, digunakan HTML, CSS, JavaScript, serta framework modern seperti React dan Vite bila diperlukan. Backend dapat memakai PHP, Node.js, dan database relasional sesuai kebutuhan proyek.',
    k: ['tools', 'software', 'teknologi', 'stack', 'canva'],
  },
  {
    q: [
      'Apakah JasaHub bisa kerja sama jangka panjang?',
      'Bisa langganan maintenance?',
      'Bisa jadi partner digital?',
      'Ada paket maintenance bulanan?',
    ],
    a: 'Bisa. Untuk kebutuhan maintenance, penambahan fitur berkala, atau kerja sama jangka panjang, silakan diskusikan dengan admin agar dibuat kesepakatan terpisah sesuai kebutuhan.',
    k: ['maintenance', 'langganan', 'partner', 'jangka panjang'],
  },
  {
    q: [
      'Apakah JasaHub menerima pembayaran DP?',
      'Bisa bayar setengah dulu?',
      'Sistem pembayaran di JasaHub bagaimana?',
      'Pembayaran bisa dicicil?',
    ],
    a: 'Pembayaran umumnya dilakukan dengan DP 50% di awal dan pelunasan setelah pekerjaan selesai. Detail pembayaran dan metode yang tersedia akan dikonfirmasi admin sebelum pengerjaan dimulai.',
    k: ['pembayaran', 'dp', 'cicil', 'transfer', 'bayar'],
  },
  {
    q: [
      'Apakah bisa minta invoice?',
      'Bisa dapat bukti pembayaran?',
      'Ada kwitansi pembayaran?',
      'Apakah pembayaran tercatat?',
    ],
    a: 'Bisa. Setelah pembayaran, kamu dapat meminta invoice atau bukti pembayaran kepada admin. Simpan bukti tersebut sebagai arsip transaksi.',
    k: ['invoice', 'kwitansi', 'bukti', 'pembayaran'],
  },
  {
    q: [
      'Apakah bisa membatalkan pesanan?',
      'Bagaimana kalau saya batal pesan?',
      'Apakah ada refund?',
      'Uang DP bisa kembali?',
    ],
    a: 'Pembatalan bisa diajukan sebelum pekerjaan dimulai. Kebijakan pengembalian DP mengikuti progres pengerjaan: jika pekerjaan belum berjalan, DP dapat dikembalikan sebagian atau penuh sesuai kesepakatan; jika sudah berjalan, DP digunakan untuk pekerjaan yang telah dilakukan.',
    k: ['batal', 'refund', 'pembatalan', 'uang'],
  },
  {
    q: [
      'Apakah JasaHub memberi diskon?',
      'Ada promo atau potongan harga?',
      'Bisa nego harga?',
      'Ada harga khusus untuk mahasiswa?',
    ],
    a: 'Harga paket sudah dibuat terjangkau. Diskon atau harga khusus dapat didiskusikan untuk proyek tertentu, misalnya pemesanan beberapa layanan sekaligus. Hubungi admin untuk penawaran terbaik.',
    k: ['diskon', 'promo', 'nego', 'harga'],
  },
  {
    q: [
      'Apakah hasil desain bisa dipakai komersial?',
      'Hak cipta hasil kerja siapa?',
      'Boleh pakai hasil untuk bisnis?',
      'Apakah file mentah diberikan?',
    ],
    a: 'Hasil akhir yang sudah dilunasi dapat digunakan untuk keperluan pribadi maupun komersial sesuai kesepakatan. Untuk file mentah atau sumber desain, silakan konfirmasikan ke admin karena pengaturannya dapat berbeda per paket.',
    k: ['hak cipta', 'komersial', 'file', 'sumber'],
  },
  {
    q: [
      'Apakah bot ini bisa melihat data saya?',
      'Apakah chat ini dibaca admin?',
      'Apakah chat saya disimpan?',
      'Berapa lama chat disimpan?',
    ],
    a: 'Chat bot ini hanya menyimpan percakapanmu sendiri selama 24 jam, setelah itu otomatis terhapus. Bot hanya menjawab berdasarkan informasi layanan JasaHub dan tidak menampilkan data akun, data admin, atau percakapan pelanggan lain.',
    k: ['chat', 'simpan', 'privasi', 'bot'],
  },
  {
    q: [
      'Apakah JasaHub menerima pesanan dari luar kota?',
      'Bisa pesan dari luar Medan?',
      'Apakah bisa online saja?',
      'Pelanggan luar pulau bisa?',
    ],
    a: 'Bisa. Seluruh proses dapat dilakukan online, mulai dari konsultasi, pengiriman materi, revisi, hingga penyerahan hasil akhir. Jadi kamu tidak harus berada di Medan.',
    k: ['luar kota', 'online', 'medan', 'jarak'],
  },
  {
    q: [
      'Berapa lama respons admin?',
      'Cepat tidak balasnya?',
      'Kalau chat kapan dibalas?',
      'Admin responsif tidak?',
    ],
    a: 'Bot ini menjawab otomatis hampir seketika. Untuk hal yang perlu keputusan admin (harga khusus, jadwal, status pesanan), admin akan merespons pada jam kerja. Tinggalkan pesan yang jelas agar mudah ditindaklanjuti.',
    k: ['respons', 'balas', 'cepat', 'admin'],
  },
];

for (const topic of aboutTopics) {
  for (const q of topic.q) add('tentang', q, topic.a, topic.k ?? []);
}

// ---------------------------------------------------------------------------
// 2. Alur pemesanan & akun pelanggan
// ---------------------------------------------------------------------------
const orderTopics: Topic[] = [
  {
    q: [
      'Bagaimana cara memesan jasa di JasaHub?',
      'Cara pesan di JasaHub gimana?',
      'Langkah pemesanan seperti apa?',
      'Saya mau pesan, caranya?',
      'Gimana cara order?',
    ],
    a: 'Caranya: buka bagian Jasa Kami, pilih layanan yang diinginkan, klik "Pesan Sekarang", lalu isi formulir (nama lengkap, nomor WhatsApp aktif, alamat, dan catatan kebutuhan). Setujui syarat & ketentuan lalu kirim. Admin akan menghubungimu melalui WhatsApp untuk konfirmasi.',
    k: ['cara pesan', 'order', 'formulir', 'pemesanan'],
  },
  {
    q: [
      'Apa saja data yang harus diisi saat memesan?',
      'Form pemesanan isinya apa?',
      'Data apa yang dibutuhkan untuk order?',
      'Syarat data pemesanan?',
    ],
    a: 'Form pemesanan meminta nama lengkap, nomor WhatsApp aktif, alamat (opsional namun membantu), dan catatan kebutuhan. Pastikan nomor WhatsApp benar karena admin akan menghubungi lewat nomor tersebut.',
    k: ['data', 'formulir', 'nama', 'whatsapp'],
  },
  {
    q: [
      'Apakah harus punya akun untuk memesan?',
      'Bisa pesan tanpa login?',
      'Perlu daftar dulu?',
      'Apakah wajib akun pelanggan?',
    ],
    a: 'Pemesanan jasa bisa dilakukan tanpa login. Akun pelanggan biasanya diberikan admin setelah layanan selesai, dan bisa dipakai untuk login ke area pelanggan serta chat dengan bot.',
    k: ['akun', 'login', 'daftar', 'pesan'],
  },
  {
    q: [
      'Bagaimana cara mendapatkan akun pelanggan?',
      'Cara buat akun pelanggan?',
      'Kapan saya dapat akun?',
      'Akun pelanggan diberikan setelah apa?',
    ],
    a: 'Setelah pesanan selesai ditangani, admin dapat membuatkan akun pelanggan untukmu. Email dan kata sandi akun akan diberikan admin. Setelah itu kamu bisa login melalui tombol MASUK di halaman utama.',
    k: ['akun', 'pelanggan', 'dibuat', 'login'],
  },
  {
    q: [
      'Bagaimana cara login akun pelanggan?',
      'Dimana tombol login?',
      'Cara masuk ke akun saya?',
      'Login pelanggan bagaimana?',
    ],
    a: 'Klik tombol MASUK di bagian atas halaman, lalu masukkan email dan kata sandi akun pelanggan yang diberikan admin. Jika lupa kata sandi, hubungi admin karena bot tidak dapat mengakses kredensial akun.',
    k: ['login', 'masuk', 'akun', 'email'],
  },
  {
    q: [
      'Saya lupa password akun, bagaimana?',
      'Cara reset kata sandi?',
      'Password akun pelanggan hilang?',
      'Tidak bisa login karena lupa sandi?',
    ],
    a: 'Untuk keamanan, bot tidak dapat menampilkan atau mengubah kata sandi. Silakan hubungi admin melalui WhatsApp atau formulir kontak untuk proses pemulihan akun.',
    k: ['lupa', 'password', 'sandi', 'reset'],
  },
  {
    q: [
      'Apakah pesanan saya bisa dilacak?',
      'Bagaimana cek status pesanan?',
      'Pesanan saya sudah sampai mana?',
      'Status order saya apa?',
    ],
    a: 'Bot tidak dapat mengakses data pesanan pribadi. Status pesanan akan diinformasikan admin melalui WhatsApp. Kamu juga bisa menanyakan langsung kepada admin dengan menyebutkan nama dan detail pesananmu.',
    k: ['status', 'pesanan', 'lacak', 'order'],
  },
  {
    q: [
      'Setelah kirim pesanan apa yang terjadi?',
      'Apakah langsung dikerjakan setelah pesan?',
      'Proses setelah order masuk?',
      'Setelah isi form pesanan?',
    ],
    a: 'Setelah pesanan terkirim, admin menerima datanya dan akan menghubungimu via WhatsApp untuk konfirmasi kebutuhan serta detail pengerjaan. Pengerjaan dimulai setelah kesepakatan dan pembayaran awal.',
    k: ['setelah', 'pesanan', 'admin', 'proses'],
  },
  {
    q: [
      'Apakah pesanan saya bisa diubah?',
      'Bisa ubah detail pesanan?',
      'Salah isi form pesanan bagaimana?',
      'Bisa revisi brief?',
    ],
    a: 'Jika ada kesalahan atau perubahan sebelum pengerjaan dimulai, segera hubungi admin melalui WhatsApp agar data pesanan bisa disesuaikan. Setelah pengerjaan berjalan, perubahan mengikuti kebijakan revisi.',
    k: ['ubah', 'pesanan', 'revisi', 'brief'],
  },
  {
    q: [
      'Apakah bisa pesan lebih dari satu layanan?',
      'Bisa bundling beberapa jasa?',
      'Pesan website dan desain sekaligus?',
      'Bisa order banyak project?',
    ],
    a: 'Bisa. Kamu dapat memesan beberapa layanan sekaligus. Sebutkan semua kebutuhanmu pada catatan pesanan atau saat konsultasi agar admin dapat menyusun penawaran dan jadwal yang sesuai.',
    k: ['bundling', 'beberapa', 'layanan', 'order'],
  },
  {
    q: [
      'Apakah ada batas waktu pemesanan?',
      'Bisa pesan kapan saja?',
      'Order 24 jam bisa?',
      'Apakah bisa pesan malam?',
    ],
    a: 'Pesanan bisa dikirim kapan saja melalui formulir. Namun respons dan pengerjaan mengikuti jam kerja admin. Untuk permintaan mendesak, tuliskan kebutuhanmu dengan jelas agar bisa diprioritaskan.',
    k: ['waktu', 'kapan', 'malam', 'pesan'],
  },
  {
    q: [
      'Apakah chat ini bisa dipakai tanpa login?',
      'Kenapa chat minta login?',
      'Chat bot harus login?',
      'Bisakah chat sebagai tamu?',
    ],
    a: 'Chat dengan bot hanya tersedia untuk pelanggan yang sudah login, agar percakapan tersimpan pada akunmu sendiri dan tidak bercampur dengan pelanggan lain. Jika belum punya akun, gunakan formulir pesanan atau kontak untuk menghubungi admin.',
    k: ['chat', 'login', 'tamu', 'akun'],
  },
];

for (const topic of orderTopics) {
  for (const q of topic.q) add('pemesanan', q, topic.a, topic.k ?? []);
}

// ---------------------------------------------------------------------------
// 3. Katalog jasa (dibangun dari SEED_JASA)
// ---------------------------------------------------------------------------
const SERVICE_DURATION: Record<string, string> = {
  'landing-page': 'sekitar 3–5 hari kerja',
  'website-tugas-kampus': 'sekitar 4–7 hari kerja',
  'website-kompleks': 'sekitar 2–4 minggu',
  'aplikasi-mobile': 'sekitar 3–6 minggu',
};

const SERVICE_TECH: Record<string, string> = {
  'landing-page':
    'HTML, CSS, dan JavaScript modern; dapat memakai React/Vite bila dibutuhkan. Website dioptimalkan untuk performa dan tampilan responsif.',
  'website-tugas-kampus':
    'HTML, CSS, JavaScript, atau framework sesuai kebutuhan tugas. Bisa ditambahkan database dan fitur CRUD sesuai scope.',
  'website-kompleks':
    'frontend modern (misalnya React/Vite), backend (Node.js atau PHP), serta database relasional seperti PostgreSQL/MySQL sesuai kebutuhan.',
  'aplikasi-mobile':
    'Flutter untuk aplikasi Android, dengan integrasi REST API dan backend bila diperlukan.',
};

for (const s of SEED_JASA) {
  const T = s.title.id;
  const P = rupiah(s.price);
  const F = s.features.map((f) => f.id).join('; ');
  const duration = SERVICE_DURATION[s.slug] ?? 'menyesuaikan kompleksitas';
  const tech = SERVICE_TECH[s.slug] ?? 'teknologi yang disepakati bersama';
  const titleKey = T.toLowerCase();
  const baseKeywords = [titleKey, 'jasa', 'layanan'];

  const topics: Topic[] = [
    {
      q: [
        `Berapa harga ${T}?`,
        `Berapa biaya pembuatan ${T}?`,
        `Tarif paket ${T} berapa?`,
        `${T} harganya berapa ya?`,
        `Bisa minta rincian harga ${T}?`,
      ],
      a: `Harga dasar paket ${T} adalah ${P}. Harga final dapat menyesuaikan kebutuhan, jumlah halaman/fitur, dan tingkat kompleksitas. Silakan konsultasikan kebutuhanmu agar admin dapat memberi penawaran yang tepat.`,
      k: [...baseKeywords, 'harga', 'biaya', 'tarif'],
    },
    {
      q: [
        `Apa itu ${T}?`,
        `Apa yang dimaksud ${T}?`,
        `${T} itu layanan apa?`,
        `Bisa jelaskan paket ${T}?`,
      ],
      a: `${T} adalah ${s.description.id}. Paket ini cocok untuk kebutuhan yang sesuai dengan deskripsi tersebut, dan dapat disesuaikan lagi lewat konsultasi.`,
      k: [...baseKeywords, 'deskripsi', 'paket'],
    },
    {
      q: [
        `Apa saja fitur ${T}?`,
        `Fitur paket ${T} apa?`,
        `Yang didapat kalau pesan ${T}?`,
        `Isi paket ${T} termasuk apa saja?`,
      ],
      a: `Fitur paket ${T} meliputi: ${F}. Detail akhir menyesuaikan kesepakatan proyek.`,
      k: [...baseKeywords, 'fitur', 'isi', 'paket'],
    },
    {
      q: [
        `Teknologi apa yang dipakai untuk ${T}?`,
        `${T} dibuat pakai apa?`,
        `Stack teknologi ${T}?`,
        `Apakah ${T} memakai framework modern?`,
      ],
      a: `Untuk ${T}, teknologi yang digunakan: ${tech} Teknologi akhir akan disesuaikan dengan kebutuhan dan kesepakatan.`,
      k: [...baseKeywords, 'teknologi', 'framework', 'stack'],
    },
    {
      q: [
        `Berapa lama pengerjaan ${T}?`,
        `Estimasi waktu ${T}?`,
        `Kapan ${T} selesai kalau dipesan sekarang?`,
        `Durasi pembuatan ${T}?`,
      ],
      a: `Estimasi pengerjaan ${T} adalah ${duration}, dihitung setelah brief dan materi lengkap serta pembayaran awal diterima. Waktu dapat berubah sesuai revisi dan antrean proyek.`,
      k: [...baseKeywords, 'durasi', 'estimasi', 'lama'],
    },
    {
      q: [
        `Apakah ${T} bisa direvisi?`,
        `Revisi ${T} berapa kali?`,
        `${T} ada revisi gratis?`,
        `Kebijakan revisi untuk ${T}?`,
      ],
      a: `Paket ${T} mendapat revisi ringan gratis. Jumlah putaran revisi mengikuti kesepakatan awal. Revisi besar atau penambahan fitur di luar scope dapat dikenakan biaya tambahan.`,
      k: [...baseKeywords, 'revisi', 'gratis', 'perbaikan'],
    },
    {
      q: [
        `Bagaimana pembayaran ${T}?`,
        `Bisa DP untuk ${T}?`,
        `Metode pembayaran ${T} apa?`,
        `${T} bayarnya kapan?`,
      ],
      a: `Untuk ${T}, pembayaran umumnya DP 50% di awal dan pelunasan setelah pekerjaan selesai. Metode pembayaran yang tersedia akan dikonfirmasi admin sebelum pengerjaan.`,
      k: [...baseKeywords, 'pembayaran', 'dp', 'transfer'],
    },
    {
      q: [
        `Bagaimana cara pesan ${T}?`,
        `Cara order ${T} gimana?`,
        `Mau pesan ${T}, langkahnya?`,
        `Alur pemesanan ${T}?`,
      ],
      a: `Untuk memesan ${T}: pilih paket di bagian Jasa Kami, klik "Pesan Sekarang", isi formulir (nama, nomor WhatsApp, alamat, catatan), setujui syarat & ketentuan, lalu kirim. Admin akan menghubungimu via WhatsApp.`,
      k: [...baseKeywords, 'cara pesan', 'order', 'pemesanan'],
    },
    {
      q: [
        `Apa hasil akhir ${T}?`,
        `Yang diserahkan setelah ${T} selesai?`,
        `Deliverable ${T} apa saja?`,
        `Format hasil ${T} seperti apa?`,
      ],
      a: `Hasil akhir ${T} diserahkan sesuai paket: file desain atau website yang sudah siap dipakai, beserta penjelasan singkat penggunaan. Untuk source code dan akses, menyesuaikan kesepakatan paket.`,
      k: [...baseKeywords, 'hasil', 'deliverable', 'serah terima'],
    },
    {
      q: [
        `Apakah dapat source code ${T}?`,
        `Kode ${T} diberikan?`,
        `Bisa minta file project ${T}?`,
        `Apakah ${T} open source?`,
      ],
      a: `Untuk ${T}, source code dapat diberikan sesuai kesepakatan (umumnya untuk paket website dan aplikasi). File mentah atau aset desain mengikuti kebijakan yang disepakati dengan admin.`,
      k: [...baseKeywords, 'source code', 'file', 'kode'],
    },
    {
      q: [
        `Apakah ${T} termasuk hosting dan domain?`,
        `Hosting ${T} bagaimana?`,
        `Domain ${T} disediakan?`,
        `Biaya hosting ${T} siapa yang tanggung?`,
      ],
      a: `Paket ${T} dapat dideploy ke hosting yang tersedia. Biaya layanan pihak ketiga seperti domain, hosting, atau API berbayar (jika diperlukan) umumnya ditanggung pelanggan, dan besarannya dikonfirmasi admin.`,
      k: [...baseKeywords, 'hosting', 'domain', 'deploy'],
    },
    {
      q: [
        `Apakah ada maintenance untuk ${T}?`,
        `Setelah ${T} selesai masih dibantu?`,
        `Support ${T} berapa lama?`,
        `Bisa minta update ${T} nanti?`,
      ],
      a: `Setelah ${T} selesai, tersedia support awal untuk kendala teknis dari pekerjaan kami. Maintenance lanjutan atau penambahan fitur dapat diatur terpisah dengan admin.`,
      k: [...baseKeywords, 'maintenance', 'support', 'update'],
    },
    {
      q: [
        `Apakah ${T} bergaransi?`,
        `Kalau ${T} error bagaimana?`,
        `Ada garansi bug untuk ${T}?`,
        `Perbaikan bug ${T} gratis?`,
      ],
      a: `Untuk ${T}, bug atau kendala teknis yang berasal dari pekerjaan kami akan diperbaiki dalam masa support awal. Kerusakan akibat perubahan pihak lain atau kelalaian penggunaan di luar cakupan garansi.`,
      k: [...baseKeywords, 'garansi', 'bug', 'error'],
    },
    {
      q: [
        `Bisa konsultasi dulu untuk ${T}?`,
        `Sebelum pesan ${T} boleh tanya?`,
        `Konsultasi ${T} gratis?`,
        `Diskusi kebutuhan ${T} dulu?`,
      ],
      a: `Tentu. Sebelum memesan ${T}, kamu bisa konsultasi gratis untuk membahas tujuan, referensi, fitur, dan estimasi. Admin akan membantu menentukan paket yang paling sesuai.`,
      k: [...baseKeywords, 'konsultasi', 'gratis', 'diskusi'],
    },
    {
      q: [
        `Apakah desain ${T} bisa request style?`,
        `Bisa pilih warna untuk ${T}?`,
        `${T} bisa sesuai brand saya?`,
        `Bisa kirim referensi desain ${T}?`,
      ],
      a: `Untuk ${T}, kamu bisa mengirim referensi desain, warna, dan gaya yang diinginkan. Semakin lengkap brief dan referensinya, semakin cepat proses pengerjaan dan semakin sesuai hasilnya.`,
      k: [...baseKeywords, 'desain', 'style', 'warna', 'referensi'],
    },
    {
      q: [
        `Apakah saya harus menyiapkan konten untuk ${T}?`,
        `Materi ${T} dari siapa?`,
        `Konten ${T} disiapkan pelanggan?`,
        `Bisa dibantu isi konten ${T}?`,
      ],
      a: `Idealnya materi seperti teks, logo, dan foto disiapkan pelanggan untuk ${T}. Namun JasaHub dapat membantu penyesuaian atau penyusunan konten dasar sesuai kesepakatan.`,
      k: [...baseKeywords, 'konten', 'materi', 'teks', 'foto'],
    },
    {
      q: [
        `Apakah ${T} sudah SEO friendly?`,
        `${T} dioptimasi untuk Google?`,
        `Bisa setting SEO untuk ${T}?`,
        `Apakah ${T} muncul di mesin pencari?`,
      ],
      a: `Paket ${T} menyertakan optimasi dasar SEO seperti struktur heading, meta dasar, dan performa. Optimasi SEO lanjutan atau strategi konten dapat didiskusikan terpisah.`,
      k: [...baseKeywords, 'seo', 'google', 'mesin pencari'],
    },
    {
      q: [
        `Apakah ${T} responsif di HP?`,
        `${T} bisa dibuka di mobile?`,
        `Tampilan ${T} di tablet bagaimana?`,
        `${T} mobile friendly?`,
      ],
      a: `Ya, ${T} dirancang responsif sehingga nyaman dibuka di HP, tablet, dan desktop. Tampilan akan disesuaikan dengan standar pengalaman pengguna yang baik.`,
      k: [...baseKeywords, 'responsif', 'mobile', 'tablet'],
    },
    {
      q: [
        `Apakah ${T} bisa punya login pengguna?`,
        `Bisa tambah autentikasi di ${T}?`,
        `${T} ada halaman admin?`,
        `Bisa multi user untuk ${T}?`,
      ],
      a: `Untuk ${T}, fitur login, hak akses pengguna, atau panel admin dapat ditambahkan sesuai kebutuhan dan paket. Sebutkan detail peran pengguna saat konsultasi agar scope-nya jelas.`,
      k: [...baseKeywords, 'login', 'autentikasi', 'admin', 'hak akses'],
    },
    {
      q: [
        `Apakah ${T} memakai database?`,
        `Bisa integrasi database di ${T}?`,
        `Data ${T} disimpan di mana?`,
        `Database ${T} apa?`,
      ],
      a: `Kebutuhan database pada ${T} disesuaikan dengan fitur. Jika diperlukan, dapat digunakan database relasional seperti PostgreSQL atau MySQL. Detail teknis ditentukan saat konsultasi.`,
      k: [...baseKeywords, 'database', 'data', 'postgresql', 'mysql'],
    },
    {
      q: [
        `Bisa integrasi WhatsApp di ${T}?`,
        `Bisa integrasi API di ${T}?`,
        `Bisa tambah payment gateway di ${T}?`,
        `${T} bisa konek layanan lain?`,
      ],
      a: `Integrasi seperti WhatsApp, REST API, atau payment gateway dapat ditambahkan pada ${T} sesuai kebutuhan. Ketersediaan dan biaya layanan pihak ketiga dikonfirmasi saat konsultasi.`,
      k: [...baseKeywords, 'integrasi', 'api', 'whatsapp', 'payment'],
    },
    {
      q: [
        `Apakah ${T} aman?`,
        `Keamanan ${T} bagaimana?`,
        `Bisa validasi input di ${T}?`,
        `${T} menerapkan keamanan dasar?`,
      ],
      a: `Paket ${T} menerapkan praktik dasar keamanan seperti validasi input dan pengelolaan akses sesuai scope. Kebutuhan keamanan khusus dapat dibahas lebih lanjut.`,
      k: [...baseKeywords, 'keamanan', 'validasi', 'aman'],
    },
    {
      q: [
        `Apakah ${T} bisa bahasa Indonesia dan Inggris?`,
        `Bisa dua bahasa untuk ${T}?`,
        `${T} support bilingual?`,
        `Bisa ganti bahasa di ${T}?`,
      ],
      a: `Jika dibutuhkan, ${T} dapat dibuat mendukung dua bahasa atau lebih. Fitur bilingual menyesuaikan kebutuhan dan akan memengaruhi scope pengerjaan.`,
      k: [...baseKeywords, 'bahasa', 'bilingual', 'inggris'],
    },
    {
      q: [
        `Bisa pengerjaan cepat untuk ${T}?`,
        `Apakah bisa rush order ${T}?`,
        `Deadline ketat ${T} bisa?`,
        `${T} bisa selesai lebih cepat?`,
      ],
      a: `Permintaan pengerjaan cepat untuk ${T} dapat diajukan, tergantung antrean dan kompleksitas. Sebutkan deadline-mu saat konsultasi agar admin bisa mengatur prioritas.`,
      k: [...baseKeywords, 'cepat', 'rush', 'deadline'],
    },
    {
      q: [
        `Apakah ${T} dirahasiakan?`,
        `Bisa NDA untuk ${T}?`,
        `Project ${T} boleh tidak dipublikasikan?`,
        `Kerahasiaan proyek ${T}?`,
      ],
      a: `Kerahasiaan proyek ${T} dapat diatur sesuai kebutuhan, termasuk permintaan agar hasil tidak dipublikasikan sebagai portofolio. Untuk NDA, silakan diskusikan dengan admin.`,
      k: [...baseKeywords, 'rahasia', 'nda', 'privasi'],
    },
    {
      q: [
        `Apakah ada diskon untuk ${T}?`,
        `Bisa nego harga ${T}?`,
        `Promo ${T} ada?`,
        `Harga ${T} bisa kurang?`,
      ],
      a: `Harga ${T} dapat didiskusikan, terutama untuk paket gabungan atau kebutuhan khusus. Hubungi admin untuk penawaran terbaik yang sesuai dengan scope pekerjaan.`,
      k: [...baseKeywords, 'diskon', 'nego', 'promo', 'harga'],
    },
    {
      q: [
        `Bagaimana serah terima ${T}?`,
        `Setelah ${T} jadi, apa langkahnya?`,
        `Cara menerima hasil ${T}?`,
        `Apakah ada demo untuk ${T}?`,
      ],
      a: `Setelah ${T} selesai, akan ada pengecekan hasil bersama. Jika sudah sesuai, hasil diserahkan beserta panduan penggunaan singkat. Untuk website/aplikasi, dapat disertakan demo atau akses uji.`,
      k: [...baseKeywords, 'serah terima', 'demo', 'hasil'],
    },
    {
      q: [
        `Apakah ${T} bisa di-update nanti?`,
        `Bisa tambah fitur setelah ${T} jadi?`,
        `Pengembangan lanjutan ${T}?`,
        `Bisa upgrade paket ${T}?`,
      ],
      a: `Pengembangan lanjutan untuk ${T} bisa dilakukan setelah proyek selesai. Penambahan fitur atau upgrade akan dihitung sebagai pekerjaan baru sesuai kebutuhan.`,
      k: [...baseKeywords, 'update', 'upgrade', 'tambah fitur'],
    },
  ];

  for (const topic of topics) {
    for (const q of topic.q) add('jasa', q, topic.a, topic.k ?? []);
  }
}

// ---------------------------------------------------------------------------
// 4. Portofolio project (dibangun dari SEED_PROJECTS)
// ---------------------------------------------------------------------------
for (const p of SEED_PROJECTS) {
  const tech = p.languages.join(', ');
  const role = p.role?.id ?? 'dikerjakan sendiri mulai dari desain hingga implementasi';
  const link = p.url || p.github;

  add(
    'project',
    `Apa itu project ${p.name}?`,
    `Project ${p.name} adalah ${p.description.id} Teknologi yang digunakan: ${tech}.`,
    [p.name.toLowerCase(), 'project', 'portofolio', ...p.languages.map((l) => l.toLowerCase())],
  );
  add(
    'project',
    `Teknologi apa yang dipakai di project ${p.name}?`,
    `Project ${p.name} dibangun menggunakan ${tech}.`,
    [p.name.toLowerCase(), 'teknologi', 'stack', ...p.languages.map((l) => l.toLowerCase())],
  );
  add(
    'project',
    `Peran apa yang diambil dalam project ${p.name}?`,
    `Pada project ${p.name}, perannya adalah ${role}.`,
    [p.name.toLowerCase(), 'peran', 'role', 'kontribusi'],
  );
  add(
    'project',
    `Project ${p.name} dibuat untuk apa?`,
    `Project ${p.name} dibuat untuk ${p.description.id}`,
    [p.name.toLowerCase(), 'tujuan', 'fungsi', 'project'],
  );
  if (link) {
    add(
      'project',
      `Bisa lihat project ${p.name} di mana?`,
      `Kamu bisa melihat project ${p.name} melalui tautan ${link}. Project lain juga ditampilkan pada bagian Tentang di halaman utama JasaHub.`,
      [p.name.toLowerCase(), 'link', 'demo', 'github', 'portofolio'],
    );
  } else {
    add(
      'project',
      `Bisa lihat project ${p.name} di mana?`,
      `Project ${p.name} ditampilkan pada bagian Tentang di halaman utama JasaHub sebagai bagian dari portofolio.`,
      [p.name.toLowerCase(), 'portofolio', 'lihat'],
    );
  }
}

// ---------------------------------------------------------------------------
// 5. Daftar jasa katalog (jawaban kanonik) & desain non-katalog
// ---------------------------------------------------------------------------
const CATALOG_LIST =
  'Jasa yang tersedia di katalog JasaHub ada 4 paket: ' +
  '1) Landing Page — Rp 500.000, ' +
  '2) Website Tugas Kampus — Rp 1.000.000, ' +
  '3) Website Kompleks — Rp 2.000.000, ' +
  '4) Aplikasi Mobile — Rp 3.000.000. ' +
  'Detail fitur tiap paket ada di bagian "Jasa Kami" pada halaman utama. ' +
  'Untuk kebutuhan di luar 4 paket tersebut, silakan konsultasi dengan admin.';

const catalogTopics: Topic[] = [
  {
    q: [
      'Sebutkan jasa apa saja yang ada',
      'Sebutkan jasa apa saja yang tersedia',
      'Jasa apa saja yang ada di JasaHub?',
      'Layanan apa saja yang tersedia?',
      'Paket apa saja yang tersedia di JasaHub?',
      'Apa saja jasa yang bisa dipesan?',
      'Daftar jasa JasaHub',
      'Jasa apa aja yang ada',
      'Ada layanan apa saja?',
      'Menu jasa apa saja?',
    ],
    a: CATALOG_LIST,
    k: ['daftar', 'jasa', 'layanan', 'paket', 'katalog', 'tersedia'],
  },
  {
    q: [
      'Desain grafis bisa?',
      'Bisa desain flyer atau poster?',
      'Jasa desain tersedia?',
      'Bisa buat spanduk?',
      'Poster bisa dipesan?',
      'Bisa desain logo?',
    ],
    a:
      'Katalog jasa JasaHub saat ini berisi 4 paket: Landing Page, Website Tugas Kampus, Website Kompleks, dan Aplikasi Mobile. ' +
      'Untuk kebutuhan desain (seperti flyer, poster, spanduk, atau logo), silakan konsultasikan langsung dengan admin melalui halaman Kontak atau WhatsApp untuk memastikan ketersediaan dan penawarannya.',
    k: ['desain', 'flyer', 'poster', 'spanduk', 'logo'],
  },
];

for (const topic of catalogTopics) {
  for (const q of topic.q) add('katalog', q, topic.a, topic.k ?? []);
}

// ---------------------------------------------------------------------------
// 6. Pertanyaan umum lain
// ---------------------------------------------------------------------------
const genericTopics: Topic[] = [
  {
    q: [
      'Berapa harga jasanya?',
      'Kisaran harga JasaHub berapa?',
      'Paket termurah apa?',
      'Berapa minimal biaya pembuatan website?',
      'Berapa tarif jasa di JasaHub?',
    ],
    a: 'Harga paket website di JasaHub dimulai dari Rp 500.000 untuk Landing Page, Rp 1.000.000 untuk Website Tugas Kampus, Rp 2.000.000 untuk Website Kompleks, dan Rp 3.000.000 untuk Aplikasi Mobile. Harga desain dan kebutuhan khusus menyesuaikan konsultasi dengan admin.',
    k: ['harga', 'biaya', 'tarif', 'paket', 'termurah'],
  },
  {
    q: [
      'Bisa revisi?',
      'Apakah bisa revisi?',
      'Revisi bisa berapa kali?',
      'Apakah ada revisi gratis?',
    ],
    a: 'Bisa. Revisi ringan gratis sampai hasil sesuai kesepakatan. Jumlah putaran revisi mengikuti kesepakatan awal; revisi besar atau penambahan fitur di luar scope dapat dikenakan biaya tambahan.',
    k: ['revisi', 'gratis', 'perbaikan'],
  },
  {
    q: [
      'Apakah bisa minta contoh desain dulu?',
      'Bisa minta mockup sebelum lanjut?',
      'Apakah ada preview sebelum jadi?',
      'Bisa lihat progres pengerjaan?',
    ],
    a: 'Untuk proyek tertentu, progres atau preview dapat ditunjukkan sebelum tahap akhir. Sampaikan kebutuhanmu saat konsultasi agar alur persetujuan desain disepakati sejak awal.',
    k: ['contoh', 'mockup', 'preview', 'progres'],
  },
  {
    q: [
      'Bagaimana kalau hasil belum sesuai?',
      'Kalau tidak cocok dengan hasilnya?',
      'Bisa minta perbaikan setelah jadi?',
      'Tidak puas dengan hasil, bagaimana?',
    ],
    a: 'Sampaikan bagian yang belum sesuai saat tahap revisi. JasaHub akan menyesuaikan selama masih dalam cakupan kesepakatan. Karena itu, pastikan brief dan referensi sudah jelas sebelum pengerjaan dimulai.',
    k: ['hasil', 'cocok', 'revisi', 'puas'],
  },
  {
    q: [
      'Apakah JasaHub bisa membuat logo?',
      'Bisa desain logo di JasaHub?',
      'Jasa pembuatan logo tersedia?',
      'Bisa bantu branding?',
    ],
    a: 'Katalog jasa JasaHub berisi 4 paket: Landing Page, Website Tugas Kampus, Website Kompleks, dan Aplikasi Mobile. Untuk kebutuhan logo atau branding khusus, silakan konsultasikan terlebih dahulu dengan admin untuk memastikan ketersediaan dan penawarannya.',
    k: ['logo', 'branding', 'desain'],
  },
  {
    q: [
      'Apakah JasaHub bisa membuat toko online?',
      'Bisa buat e-commerce?',
      'Bisa pesan website jualan?',
      'Apakah tersedia pembuatan marketplace?',
    ],
    a: 'Pembuatan toko online dapat masuk dalam kategori Website Kompleks, dengan fitur katalog, keranjang, dan pembayaran sesuai kebutuhan. Detail fitur, integrasi, dan biaya dibahas saat konsultasi.',
    k: ['toko online', 'ecommerce', 'jualan', 'website'],
  },
  {
    q: [
      'Apakah bisa buat sistem informasi?',
      'Bisa pesan sistem CRUD?',
      'Bisa buat dashboard admin?',
      'Apakah bisa membuat aplikasi berbasis web?',
    ],
    a: 'Bisa. Sistem informasi, dashboard admin, dan aplikasi berbasis web masuk dalam cakupan Website Kompleks atau Website Tugas Kampus, tergantung kebutuhan dan tingkat kerumitannya.',
    k: ['sistem informasi', 'dashboard', 'crud', 'aplikasi'],
  },
  {
    q: [
      'Apakah bisa membuat aplikasi Android?',
      'Bisa pesan aplikasi mobile?',
      'Aplikasi iOS juga bisa?',
      'Aplikasi HP bisa dibuat?',
    ],
    a: 'JasaHub menyediakan paket Aplikasi Mobile dengan estimasi 3–6 minggu. Untuk target platform (Android/iOS) dan fitur, silakan konsultasikan agar scope serta biayanya jelas.',
    k: ['android', 'mobile', 'aplikasi', 'ios'],
  },
  {
    q: [
      'Apakah harga sudah termasuk PPN?',
      'Apakah ada biaya pajak?',
      'Harga belum termasuk apa?',
      'Biaya tambahan apa saja?',
    ],
    a: 'Harga yang tercantum adalah harga jasa pengerjaan. Biaya pihak ketiga seperti domain, hosting, API berbayar, atau biaya cetak tidak termasuk dan akan diinformasikan admin bila diperlukan.',
    k: ['pajak', 'ppn', 'biaya', 'tambahan'],
  },
  {
    q: [
      'Apakah bisa request desain revisi berkali-kali?',
      'Bisa revisi sampai puas?',
      'Revisi desain dibatasi?',
      'Berapa batas revisi?',
    ],
    a: 'Revisi ringan diberikan sampai hasil sesuai kesepakatan, dengan cakupan yang wajar. Perubahan konsep besar atau penambahan scope di luar kesepakatan dihitung sebagai pekerjaan tambahan.',
    k: ['revisi', 'batas', 'puas'],
  },
];

for (const topic of genericTopics) {
  for (const q of topic.q) add('umum', q, topic.a, topic.k ?? []);
}

// ---------------------------------------------------------------------------
// 7. Sapaan, ucapan terima kasih, dan penutup
// ---------------------------------------------------------------------------
const smallTalk: Topic[] = [
  {
    q: ['Halo', 'Hai', 'Halo bot', 'Hai bot', 'Hello', 'Selamat pagi', 'Selamat siang', 'Selamat malam', 'Assalamualaikum'],
    a: 'Halo! Saya Bot JasaHUB. Saya bisa membantu menjelaskan layanan, harga paket, cara pemesanan, portofolio, dan kontak JasaHub. Ada yang ingin ditanyakan?',
    k: ['halo', 'hai', 'sapaan'],
  },
  {
    q: ['Terima kasih', 'Makasih', 'Thanks', 'Terima kasih ya', 'Oke terima kasih'],
    a: 'Sama-sama! Kalau ada pertanyaan lain tentang layanan atau cara pemesanan JasaHub, silakan tanyakan lagi.',
    k: ['terima kasih', 'makasih', 'thanks'],
  },
  {
    q: ['Sampai jumpa', 'Dadah', 'Bye', 'Selamat tinggal', 'Cukup sekian'],
    a: 'Sampai jumpa! Semoga informasinya membantu. Kamu bisa kembali ke chat ini kapan saja (percakapan tersimpan 24 jam).',
    k: ['bye', 'sampai jumpa', 'dadah'],
  },
  {
    q: ['Kamu siapa?', 'Kamu bot apa?', 'Apakah ini bot?', 'Siapa yang membalas chat ini?'],
    a: 'Saya Bot JasaHUB, asisten otomatis yang menjawab berdasarkan informasi layanan di website JasaHub. Saya bukan admin dan tidak dapat mengakses data akun atau pesanan.',
    k: ['bot', 'siapa', 'asisten'],
  },
  {
    q: ['Bisa bantu apa?', 'Apa yang bisa kamu lakukan?', 'Topik apa saja yang bisa ditanyakan?', 'Fitur bot ini apa?'],
    a: 'Saya dapat membantu menjelaskan tentang JasaHub, daftar layanan dan harga, fitur tiap paket, cara pemesanan, portofolio project, kebijakan revisi/pembayaran, serta cara menghubungi admin.',
    k: ['bantu', 'kemampuan', 'topik', 'fitur'],
  },
];

for (const topic of smallTalk) {
  for (const q of topic.q) add('umum', q, topic.a, topic.k ?? []);
}

export const SEED_CHAT_KNOWLEDGE: ChatKnowledgeSeed[] = rows;

export const CHAT_KNOWLEDGE_COUNT = rows.length;
