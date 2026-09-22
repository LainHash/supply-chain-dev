import React from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button } from 'reactstrap';
import { QRCodeCanvas } from 'qrcode.react';
import Toast from '../Toast';
import logoMini from '../../Assests/Images/logo_mini.png';

const QRCodeModal = ({
  isOpen,
  toggle,
  productId,
  productTitle,
  productImage,
  manufacturerName,
  launchDate
}) => {
  const traceUrl = `${window.location.origin}/trace/${productId}`;

  const downloadQR = () => {
    try {
      const canvas = document.getElementById(`qr-code-canvas-${productId}`);
      if (!canvas) {
        Toast("error", "Không tìm thấy canvas mã QR");
        return;
      }
      const pngUrl = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.href = pngUrl;
      downloadLink.download = `QR-Truy-Xuat-SP-${productId}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);
      Toast("success", "Đã tải xuống mã QR thành công!");
    } catch (error) {
      console.error("Lỗi khi tải mã QR:", error);
      Toast("error", "Không thể tải mã QR");
    }
  };

  const copyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(traceUrl);
      Toast("success", "Đã sao chép liên kết truy xuất nguồn gốc!");
    } else {
      const el = document.createElement('textarea');
      el.value = traceUrl;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      Toast("success", "Đã sao chép liên kết!");
    }
  };

  const printLabel = () => {
    const printWindow = window.open('', '_blank', 'width=600,height=700');
    const canvas = document.getElementById(`qr-code-canvas-${productId}`);
    const qrDataUrl = canvas ? canvas.toDataURL("image/png") : "";

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Tem Truy Xuất Nguồn Gốc - Sản phẩm #${productId}</title>
          <style>
            @page {
              size: 80mm 100mm;
              margin: 4mm;
            }
            body {
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
              color: #222;
              margin: 0;
              padding: 10px;
              text-align: center;
              background: #fff;
            }
            .label-card {
              border: 2px dashed #0d6efd;
              border-radius: 12px;
              padding: 16px;
              max-width: 320px;
              margin: 0 auto;
            }
            .header-tag {
              background: #0d6efd;
              color: white;
              font-size: 11px;
              font-weight: 700;
              text-transform: uppercase;
              letter-spacing: 0.5px;
              padding: 4px 10px;
              border-radius: 20px;
              display: inline-block;
              margin-bottom: 8px;
            }
            .title {
              font-size: 16px;
              font-weight: 700;
              margin: 4px 0 2px 0;
              color: #111;
            }
            .product-id {
              font-size: 12px;
              color: #666;
              margin-bottom: 12px;
              font-weight: 600;
            }
            .qr-wrapper {
              background: white;
              padding: 10px;
              border-radius: 8px;
              display: inline-block;
              box-shadow: 0 2px 6px rgba(0,0,0,0.1);
            }
            .qr-wrapper img {
              width: 180px;
              height: 180px;
              display: block;
            }
            .instruction {
              font-size: 11px;
              color: #444;
              margin-top: 10px;
              font-weight: 500;
            }
            .footer-info {
              font-size: 10px;
              color: #777;
              margin-top: 8px;
              border-top: 1px solid #eee;
              padding-top: 6px;
            }
          </style>
        </head>
        <body>
          <div class="label-card">
            <div class="header-tag">ETH BLOCKCHAIN VERIFIED</div>
            <div class="title">${productTitle || `Sản phẩm #${productId}`}</div>
            <div class="product-id">Mã sản phẩm: #${productId}</div>
            <div class="qr-wrapper">
              <img src="${qrDataUrl}" alt="Mã QR Truy Xuất" />
            </div>
            <div class="instruction">
              Quét mã QR bằng máy ảnh để tra cứu nguồn gốc và lịch sử chuỗi cung ứng
            </div>
            <div class="footer-info">
              ${manufacturerName ? `Nhà sản xuất: ${manufacturerName} | ` : ''}
              Hệ thống Chuỗi cung ứng Thực phẩm Minh bạch
            </div>
          </div>
          <script>
            window.onload = function() {
              window.print();
              window.onafterprint = function() { window.close(); }
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <Modal isOpen={isOpen} toggle={toggle} centered size="md">
      <ModalHeader toggle={toggle} className="border-bottom-0 pb-0">
        <div className="d-flex align-items-center">
          <i className="fa fa-qrcode text-warning me-2 fa-lg" />
          <span className="fw-bold">Tem Mã QR Truy Xuất Nguồn Gốc</span>
        </div>
      </ModalHeader>
      <ModalBody className="text-center pt-2">
        {/* Tem Nhãn Trực Quan */}
        <div 
          className="p-3 mx-auto rounded-3 border border-2 border-primary bg-light shadow-sm"
          style={{ maxWidth: '340px' }}
        >
          <div className="d-flex justify-content-between align-items-center mb-2 px-1">
            <span className="badge bg-primary text-uppercase px-2 py-1" style={{ fontSize: '10px' }}>
              <i className="fa fa-check-circle me-1" /> Blockchain Verified
            </span>
            <span className="text-muted" style={{ fontSize: '11px', fontWeight: 'bold' }}>
              ID: #{productId}
            </span>
          </div>

          <h5 className="fw-bold text-dark mb-1 text-truncate" title={productTitle}>
            {productTitle || `Sản phẩm #${productId}`}
          </h5>
          {manufacturerName && (
            <div className="text-muted small mb-2">
              <i className="fa fa-industry me-1" /> {manufacturerName}
            </div>
          )}

          {/* QR Code Canvas */}
          <div className="bg-white p-2 rounded-2 d-inline-block shadow-sm my-2">
            <QRCodeCanvas
              id={`qr-code-canvas-${productId}`}
              value={traceUrl}
              size={210}
              level="H"
              includeMargin={true}
              imageSettings={{
                src: logoMini,
                x: undefined,
                y: undefined,
                height: 38,
                width: 38,
                excavate: true,
              }}
            />
          </div>

          <p className="small text-secondary mb-1 mt-2">
            <i className="fa fa-camera me-1" /> Dùng camera điện thoại để quét và kiểm tra nguồn gốc
          </p>

          <div className="input-group input-group-sm mt-2">
            <input 
              type="text" 
              className="form-control text-muted bg-white" 
              readOnly 
              value={traceUrl} 
              style={{ fontSize: '11px' }}
            />
            <button className="btn btn-outline-secondary btn-sm" type="button" onClick={copyUrl} title="Sao chép">
              <i className="fa fa-copy" />
            </button>
          </div>
        </div>

        {/* Nút thao tác */}
        <div className="d-flex justify-content-center gap-2 mt-4 flex-wrap">
          <Button color="success" className="px-3" onClick={downloadQR}>
            <i className="fa fa-download me-1" /> Tải Ảnh QR (PNG)
          </Button>
          <Button color="primary" className="px-3" onClick={printLabel}>
            <i className="fa fa-print me-1" /> In Tem Nhãn
          </Button>
          <Button 
            color="info" 
            outline 
            className="px-3" 
            tag="a" 
            href={traceUrl} 
            target="_blank" 
            rel="noopener noreferrer"
          >
            <i className="fa fa-external-link me-1" /> Mở Trang Tra Cứu
          </Button>
        </div>
      </ModalBody>
      <ModalFooter className="border-top-0 pt-0 justify-content-center">
        <Button color="secondary" outline size="sm" onClick={toggle}>
          Đóng
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default QRCodeModal;
