"use client";

import { useRouter } from "next/navigation";

export default function PrivacyPage() {
  const router = useRouter();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; background: #071412; }

        .pp-root {
          min-height: 100vh;
          background: #071412;
          color: #FFFFFF;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }

        .pp-header {
          position: sticky;
          top: 0;
          z-index: 50;
          background: rgba(7,20,18,0.95);
          backdrop-filter: blur(12px);
          border-bottom: 1px solid rgba(2,195,154,0.15);
          padding: 16px 24px;
          display: flex;
          align-items: center;
          gap: 14px;
        }

        .pp-back {
          background: none;
          border: none;
          color: rgba(255,255,255,0.5);
          font-size: 20px;
          cursor: pointer;
          padding: 4px 8px;
          border-radius: 8px;
          transition: color 0.2s;
          font-family: inherit;
        }
        .pp-back:hover { color: #02C39A; }

        .pp-header-title {
          font-size: 15px;
          font-weight: 700;
          color: #FFFFFF;
        }
        .pp-header-sub {
          font-size: 12px;
          color: rgba(255,255,255,0.4);
          margin-top: 1px;
        }

        .pp-hero {
          background: linear-gradient(135deg, rgba(2,195,154,0.08) 0%, transparent 60%);
          border-bottom: 1px solid rgba(2,195,154,0.1);
          padding: 48px 24px 40px;
          text-align: center;
        }

        .pp-hero-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          border-radius: 20px;
          background: rgba(2,195,154,0.1);
          border: 1px solid rgba(2,195,154,0.25);
          font-size: 12px;
          font-weight: 600;
          color: #02C39A;
          margin-bottom: 20px;
          letter-spacing: 0.3px;
        }

        .pp-hero h1 {
          font-size: 28px;
          font-weight: 800;
          color: #FFFFFF;
          letter-spacing: -0.5px;
          margin-bottom: 12px;
          line-height: 1.2;
        }
        .pp-hero h1 span { color: #02C39A; }

        .pp-hero p {
          font-size: 14px;
          color: rgba(255,255,255,0.5);
          line-height: 1.6;
          max-width: 480px;
          margin: 0 auto 20px;
        }

        .pp-meta {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .pp-meta-item {
          font-size: 12px;
          color: rgba(255,255,255,0.35);
        }
        .pp-meta-dot {
          width: 3px; height: 3px;
          border-radius: 50%;
          background: rgba(255,255,255,0.2);
          display: inline-block;
        }

        .pp-content {
          max-width: 720px;
          margin: 0 auto;
          padding: 48px 24px 80px;
        }

        .pp-toc {
          background: rgba(2,195,154,0.05);
          border: 1px solid rgba(2,195,154,0.15);
          border-radius: 14px;
          padding: 24px;
          margin-bottom: 48px;
        }
        .pp-toc-title {
          font-size: 12px;
          font-weight: 700;
          color: #02C39A;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          margin-bottom: 14px;
        }
        .pp-toc a {
          display: block;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          text-decoration: none;
          padding: 5px 0;
          transition: color 0.2s;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .pp-toc a:last-child { border-bottom: none; }
        .pp-toc a:hover { color: #02C39A; }
        .pp-toc-num {
          color: rgba(2,195,154,0.6);
          margin-right: 8px;
          font-weight: 600;
        }

        .pp-section {
          margin-bottom: 48px;
          scroll-margin-top: 80px;
        }

        .pp-section-num {
          font-size: 11px;
          font-weight: 700;
          color: #02C39A;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-bottom: 8px;
        }

        .pp-section h2 {
          font-size: 20px;
          font-weight: 800;
          color: #FFFFFF;
          margin-bottom: 16px;
          letter-spacing: -0.3px;
        }

        .pp-section p {
          font-size: 14px;
          color: rgba(255,255,255,0.65);
          line-height: 1.8;
          margin-bottom: 14px;
        }

        .pp-section ul {
          list-style: none;
          margin-bottom: 14px;
        }
        .pp-section ul li {
          font-size: 14px;
          color: rgba(255,255,255,0.65);
          line-height: 1.7;
          padding: 6px 0 6px 20px;
          position: relative;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .pp-section ul li:last-child { border-bottom: none; }
        .pp-section ul li::before {
          content: '';
          position: absolute;
          left: 0; top: 14px;
          width: 6px; height: 6px;
          border-radius: 50%;
          background: #02C39A;
          opacity: 0.6;
        }

        .pp-highlight {
          background: rgba(2,195,154,0.06);
          border: 1px solid rgba(2,195,154,0.15);
          border-left: 3px solid #02C39A;
          border-radius: 0 10px 10px 0;
          padding: 16px 20px;
          margin: 16px 0;
          font-size: 14px;
          color: rgba(255,255,255,0.7);
          line-height: 1.7;
        }
        .pp-highlight strong { color: #02C39A; }

        .pp-table {
          width: 100%;
          border-collapse: collapse;
          margin: 16px 0;
          font-size: 13px;
        }
        .pp-table th {
          background: rgba(2,195,154,0.1);
          color: #02C39A;
          font-weight: 700;
          padding: 10px 14px;
          text-align: left;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .pp-table td {
          padding: 10px 14px;
          color: rgba(255,255,255,0.6);
          border-bottom: 1px solid rgba(255,255,255,0.06);
          vertical-align: top;
          line-height: 1.6;
        }
        .pp-table tr:last-child td { border-bottom: none; }
        .pp-table tr:nth-child(even) td { background: rgba(255,255,255,0.02); }

        .pp-divider {
          height: 1px;
          background: linear-gradient(90deg, transparent, rgba(2,195,154,0.15), transparent);
          margin: 48px 0;
        }

        .pp-contact-box {
          background: linear-gradient(135deg, rgba(2,195,154,0.08), rgba(1,115,103,0.08));
          border: 1px solid rgba(2,195,154,0.2);
          border-radius: 16px;
          padding: 28px;
          text-align: center;
        }
        .pp-contact-box h3 {
          font-size: 18px;
          font-weight: 800;
          color: #FFFFFF;
          margin-bottom: 10px;
        }
        .pp-contact-box p {
          font-size: 14px;
          color: rgba(255,255,255,0.5);
          margin-bottom: 16px;
          line-height: 1.6;
        }
        .pp-contact-email {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 12px 24px;
          border-radius: 10px;
          background: rgba(2,195,154,0.15);
          border: 1px solid rgba(2,195,154,0.3);
          color: #02C39A;
          font-size: 15px;
          font-weight: 700;
          text-decoration: none;
          transition: background 0.2s;
        }
        .pp-contact-email:hover {
          background: rgba(2,195,154,0.25);
        }

        .pp-footer {
          text-align: center;
          padding: 32px 24px;
          border-top: 1px solid rgba(2,195,154,0.1);
          font-size: 12px;
          color: rgba(255,255,255,0.2);
          line-height: 1.8;
        }
      `}</style>

      <div className="pp-root">

        {/* Sticky header */}
        <div className="pp-header">
          <button className="pp-back" onClick={() => router.back()}>←</button>
          <div>
            <div className="pp-header-title">Kebijakan Privasi</div>
            <div className="pp-header-sub">SahAIbat Kader — Vinatra</div>
          </div>
        </div>

        {/* Hero */}
        <div className="pp-hero">
          <div className="pp-hero-badge">🔒 Privasi & Keamanan Data</div>
          <h1>Kebijakan <span>Privasi</span></h1>
          <p>
            Kami berkomitmen menjaga keamanan data Kader dan pasien dengan standar
            tertinggi sesuai hukum Indonesia.
          </p>
          <div className="pp-meta">
            <span className="pp-meta-item">Berlaku mulai: 1 April 2026</span>
            <span className="pp-meta-dot" />
            <span className="pp-meta-item">Versi 1.0</span>
            <span className="pp-meta-dot" />
            <span className="pp-meta-item">Bahasa Indonesia</span>
          </div>
        </div>

        {/* Content */}
        <div className="pp-content">

          {/* Table of contents */}
          <div className="pp-toc">
            <div className="pp-toc-title">Daftar Isi</div>
            <a href="#s1"><span className="pp-toc-num">1.</span>Tentang Aplikasi Ini</a>
            <a href="#s2"><span className="pp-toc-num">2.</span>Data yang Kami Kumpulkan</a>
            <a href="#s3"><span className="pp-toc-num">3.</span>Bagaimana Data Digunakan</a>
            <a href="#s4"><span className="pp-toc-num">4.</span>Penyimpanan & Keamanan</a>
            <a href="#s5"><span className="pp-toc-num">5.</span>Siapa yang Dapat Mengakses Data</a>
            <a href="#s6"><span className="pp-toc-num">6.</span>Hak Anda</a>
            <a href="#s7"><span className="pp-toc-num">7.</span>Retensi Data</a>
            <a href="#s8"><span className="pp-toc-num">8.</span>Perubahan Kebijakan</a>
            <a href="#s9"><span className="pp-toc-num">9.</span>Hubungi Kami</a>
          </div>

          {/* Section 1 */}
          <div className="pp-section" id="s1">
            <div className="pp-section-num">Bagian 1</div>
            <h2>Tentang Aplikasi Ini</h2>
            <p>
              SahAIbat Kader adalah aplikasi web progresif (PWA) yang dirancang khusus
              untuk Kader Posyandu terdaftar. Aplikasi ini membantu Kader melakukan
              triase kesehatan balita, ibu hamil, ibu nifas, dan bayi baru lahir secara
              offline menggunakan standar KMS Permenkes 2/2020.
            </p>
            <div className="pp-highlight">
              <strong>Penting:</strong> Aplikasi ini hanya untuk Kader terdaftar yang
              telah mendapatkan izin dari NGO mitra. Aplikasi ini bukan layanan publik
              dan tidak dapat digunakan oleh masyarakat umum.
            </div>
            <p>
              Pengelola aplikasi ini adalah <strong style={{color:"#FFFFFF"}}>Vinatra
              (11679210 Canada Inc)</strong>, bertindak sebagai Prosesor Data
              berdasarkan UU PDP No. 27/2022. NGO mitra Anda bertindak sebagai
              Pengendali Data.
            </p>
          </div>

          <div className="pp-divider" />

          {/* Section 2 */}
          <div className="pp-section" id="s2">
            <div className="pp-section-num">Bagian 2</div>
            <h2>Data yang Kami Kumpulkan</h2>
            <p>Kami mengumpulkan data yang diperlukan untuk menjalankan triase kesehatan:</p>

            <table className="pp-table">
              <thead>
                <tr>
                  <th>Jenis Data</th>
                  <th>Contoh</th>
                  <th>Tujuan</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Data Kader</strong></td>
                  <td>Nama, nomor WhatsApp</td>
                  <td>Identifikasi & autentikasi Kader</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Data Anak</strong></td>
                  <td>Nama, usia, berat, tinggi, LILA</td>
                  <td>Triase tumbuh kembang Posyandu</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Data Ibu Hamil</strong></td>
                  <td>Usia kehamilan, tanda bahaya</td>
                  <td>Triase antenatal berbasis KMS</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Data Ibu Nifas</strong></td>
                  <td>Hari pasca melahirkan, gejala</td>
                  <td>Triase pasca persalinan</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Data Bayi Baru Lahir</strong></td>
                  <td>Usia hari, tanda bahaya neonatal</td>
                  <td>Triase neonatal 0–28 hari</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Data Teknis</strong></td>
                  <td>Waktu sinkronisasi, status jaringan</td>
                  <td>Operasional sistem & sinkronisasi</td>
                </tr>
              </tbody>
            </table>

            <div className="pp-highlight">
              <strong>Kami tidak mengumpulkan:</strong> Foto, rekaman suara, data
              lokasi GPS, informasi kartu kredit, atau data sensitif lain yang tidak
              relevan dengan triase kesehatan.
            </div>
          </div>

          <div className="pp-divider" />

          {/* Section 3 */}
          <div className="pp-section" id="s3">
            <div className="pp-section-num">Bagian 3</div>
            <h2>Bagaimana Data Digunakan</h2>
            <p>Data yang dikumpulkan digunakan semata-mata untuk:</p>
            <ul>
              <li>Menjalankan triase kesehatan berbasis standar WHO dan KMS Permenkes 2/2020</li>
              <li>Menyimpan hasil triase secara lokal di perangkat Kader (offline-first)</li>
              <li>Menyinkronkan data ke server NGO mitra saat koneksi internet tersedia</li>
              <li>Menghasilkan laporan triase untuk keperluan program NGO</li>
              <li>Mendukung pemantauan tumbuh kembang anak secara berkelanjutan</li>
            </ul>
            <p>
              Data <strong style={{color:"#FFFFFF"}}>tidak digunakan</strong> untuk
              iklan, analitik komersial, pelatihan model AI pihak ketiga, atau dijual
              kepada pihak mana pun.
            </p>
          </div>

          <div className="pp-divider" />

          {/* Section 4 */}
          <div className="pp-section" id="s4">
            <div className="pp-section-num">Bagian 4</div>
            <h2>Penyimpanan & Keamanan</h2>
            <ul>
              <li>
                <strong style={{color:"#FFFFFF"}}>Lokasi server:</strong> AWS ap-southeast-3
                (Jakarta, Indonesia) — sesuai persyaratan lokalisasi data UU PDP
              </li>
              <li>
                <strong style={{color:"#FFFFFF"}}>Enkripsi:</strong> AES-256 saat penyimpanan
                (at rest) dan TLS 1.3 saat transmisi (in transit)
              </li>
              <li>
                <strong style={{color:"#FFFFFF"}}>Keamanan basis data:</strong> Row-Level
                Security (RLS) — setiap NGO hanya dapat mengakses data Kadernya sendiri
              </li>
              <li>
                <strong style={{color:"#FFFFFF"}}>Penyimpanan lokal:</strong> Data triase
                disimpan di IndexedDB perangkat Kader menggunakan enkripsi browser standar
              </li>
              <li>
                <strong style={{color:"#FFFFFF"}}>Akses admin:</strong> Dibatasi hanya
                untuk staf teknis Vinatra yang memiliki kebutuhan bisnis yang sah
              </li>
            </ul>
          </div>

          <div className="pp-divider" />

          {/* Section 5 */}
          <div className="pp-section" id="s5">
            <div className="pp-section-num">Bagian 5</div>
            <h2>Siapa yang Dapat Mengakses Data</h2>
            <table className="pp-table">
              <thead>
                <tr>
                  <th>Pihak</th>
                  <th>Akses</th>
                  <th>Dasar Hukum</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Kader (pengguna)</strong></td>
                  <td>Data yang ia input sendiri</td>
                  <td>Operasional triase</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Admin NGO mitra</strong></td>
                  <td>Semua data Kader NGO tersebut</td>
                  <td>Perjanjian NGO–Vinatra</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Vinatra (Prosesor)</strong></td>
                  <td>Akses teknis terbatas</td>
                  <td>UU PDP No. 27/2022</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Pihak ketiga</strong></td>
                  <td>Tidak ada akses</td>
                  <td>—</td>
                </tr>
                <tr>
                  <td><strong style={{color:"#FFFFFF"}}>Otoritas hukum</strong></td>
                  <td>Hanya jika diwajibkan oleh hukum</td>
                  <td>Perintah pengadilan yang sah</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="pp-divider" />

          {/* Section 6 */}
          <div className="pp-section" id="s6">
            <div className="pp-section-num">Bagian 6</div>
            <h2>Hak Anda</h2>
            <p>
              Berdasarkan UU PDP No. 27/2022, Anda memiliki hak-hak berikut terhadap
              data pribadi Anda:
            </p>
            <ul>
              <li><strong style={{color:"#FFFFFF"}}>Hak akses</strong> — meminta salinan data pribadi Anda</li>
              <li><strong style={{color:"#FFFFFF"}}>Hak koreksi</strong> — meminta perbaikan data yang tidak akurat</li>
              <li><strong style={{color:"#FFFFFF"}}>Hak penghapusan</strong> — meminta penghapusan data Anda</li>
              <li><strong style={{color:"#FFFFFF"}}>Hak portabilitas</strong> — menerima data dalam format terstruktur</li>
              <li><strong style={{color:"#FFFFFF"}}>Hak keberatan</strong> — menolak pemrosesan data tertentu</li>
            </ul>
            <p>
              Untuk menggunakan hak-hak ini, hubungi NGO mitra Anda atau kirim email
              ke <strong style={{color:"#02C39A"}}>privacy@sahaibat.com</strong>.
              Kami akan merespons dalam 14 hari kerja.
            </p>
          </div>

          <div className="pp-divider" />

          {/* Section 7 */}
          <div className="pp-section" id="s7">
            <div className="pp-section-num">Bagian 7</div>
            <h2>Retensi Data</h2>
            <p>
              Data disimpan sesuai ketentuan Permenkes No. 24/2022 tentang
              rekam medis:
            </p>
            <ul>
              <li>Data triase anak (pertumbuhan, perkembangan): <strong style={{color:"#FFFFFF"}}>5 tahun</strong></li>
              <li>Data SAM (Severely Acute Malnutrition): <strong style={{color:"#FFFFFF"}}>7 tahun</strong></li>
              <li>Data ibu hamil dan nifas: <strong style={{color:"#FFFFFF"}}>5 tahun</strong></li>
              <li>Data neonatal: <strong style={{color:"#FFFFFF"}}>5 tahun</strong></li>
            </ul>
            <p>
              Setelah masa retensi berakhir, data dihapus secara permanen dari
              semua sistem kami dalam 90 hari.
            </p>
            <div className="pp-highlight">
              <strong>Ekspor data:</strong> NGO mitra dapat meminta ekspor lengkap
              data mereka kapan saja. Kami akan menyediakannya dalam 5 hari kerja
              dalam format CSV atau JSON.
            </div>
          </div>

          <div className="pp-divider" />

          {/* Section 8 */}
          <div className="pp-section" id="s8">
            <div className="pp-section-num">Bagian 8</div>
            <h2>Perubahan Kebijakan</h2>
            <p>
              Jika kami membuat perubahan material pada kebijakan ini, kami akan
              memberitahu NGO mitra melalui email setidaknya 30 hari sebelum
              perubahan berlaku. Untuk perubahan minor, kami akan memperbarui
              tanggal revisi di halaman ini.
            </p>
            <p>
              Penggunaan aplikasi yang berkelanjutan setelah tanggal berlaku
              merupakan persetujuan Anda terhadap kebijakan yang diperbarui.
            </p>
          </div>

          <div className="pp-divider" />

          {/* Section 9 — Contact */}
          <div className="pp-section" id="s9">
            <div className="pp-section-num">Bagian 9</div>
            <h2>Hubungi Kami</h2>
            <div className="pp-contact-box">
              <h3>Petugas Perlindungan Data (Privacy Officer)</h3>
              <p>
                Untuk pertanyaan, permintaan akses data, atau pelaporan masalah
                privasi, hubungi kami melalui email:
              </p>
              <a href="mailto:privacy@sahaibat.com" className="pp-contact-email">
                ✉️ privacy@sahaibat.com
              </a>
              <p style={{marginTop: 16, fontSize: 13, color: "rgba(255,255,255,0.3)"}}>
                Kami merespons dalam 14 hari kerja.<br />
                Vinatra · 11679210 Canada Inc
              </p>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pp-footer">
          © 2026 SahAIbat Health — Vinatra (11679210 Canada Inc)<br />
          Terdaftar sebagai PSE Lingkup Privat Asing – NIB: 1202260248509<br />
          Registered Foreign Electronic System Operator (PSE) – NIB: 1202260248509
        </div>

      </div>
    </>
  );
}
