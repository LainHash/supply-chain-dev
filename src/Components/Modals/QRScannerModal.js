import React, { useEffect, useState, useRef } from 'react';
import { Modal, ModalHeader, ModalBody, ModalFooter, Button, Input, InputGroup } from 'reactstrap';
import { Html5Qrcode } from 'html5-qrcode';
import Toast from '../Toast';

const QRScannerModal = ({ isOpen, toggle, onScanSuccess }) => {
  const [activeTab, setActiveTab] = useState('camera'); // 'camera', 'file', 'manual'
  const [manualId, setManualId] = useState('');
  const [cameraError, setCameraError] = useState(null);
  const [scanning, setScanning] = useState(false);
  const qrScannerRef = useRef(null);

  // Helper to extract product ID from scanned string (either URL or raw number)
  const extractProductId = (scannedText) => {
    if (!scannedText) return '';
    const trimmed = scannedText.trim();
    if (trimmed.includes('/trace/')) {
      const parts = trimmed.split('/trace/');
      return parts[parts.length - 1].split('?')[0].split('#')[0];
    }
    if (trimmed.includes('/products/')) {
      const parts = trimmed.split('/products/');
      return parts[parts.length - 1].split('?')[0].split('#')[0];
    }
    return trimmed;
  };

  const handleResult = (decodedText) => {
    stopCamera();
    const productId = extractProductId(decodedText);
    if (productId) {
      Toast('success', `Đã quét thành công mã sản phẩm #${productId}!`);
      toggle();
      if (onScanSuccess) {
        onScanSuccess(productId);
      }
    } else {
      Toast('error', 'Không nhận diện được mã sản phẩm hợp lệ.');
    }
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      if (!qrScannerRef.current) {
        qrScannerRef.current = new Html5Qrcode('qr-reader-container');
      }
      
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      await qrScannerRef.current.start(
        { facingMode: 'environment' },
        config,
        (decodedText) => {
          handleResult(decodedText);
        },
        (errorMessage) => {
          // ignore minor frame read errors
        }
      );
      setScanning(true);
    } catch (err) {
      console.warn('Lỗi bật camera:', err);
      setCameraError(
        'Không thể truy cập camera. Vui lòng cấp quyền truy cập máy ảnh hoặc chuyển sang chế độ tải ảnh tem QR.'
      );
      setScanning(false);
    }
  };

  const stopCamera = async () => {
    if (qrScannerRef.current && scanning) {
      try {
        await qrScannerRef.current.stop();
        qrScannerRef.current.clear();
      } catch (err) {
        console.warn('Lỗi khi dừng camera:', err);
      }
      setScanning(false);
    }
  };

  useEffect(() => {
    if (isOpen && activeTab === 'camera') {
      // Small timeout to allow Modal DOM to mount
      const timer = setTimeout(() => {
        startCamera();
      }, 350);
      return () => clearTimeout(timer);
    } else {
      stopCamera();
    }
  }, [isOpen, activeTab]);

  const handleModalClose = () => {
    stopCamera();
    toggle();
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const html5QrCode = new Html5Qrcode('file-qr-temp');
      const decodedText = await html5QrCode.scanFile(file, true);
      html5QrCode.clear();
      handleResult(decodedText);
    } catch (err) {
      console.error('Lỗi phân tích file ảnh QR:', err);
      Toast('error', 'Không tìm thấy mã QR trong ảnh vừa tải lên.');
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!manualId.trim()) {
      Toast('error', 'Vui lòng nhập mã ID sản phẩm');
      return;
    }
    handleResult(manualId);
  };

  return (
    <Modal isOpen={isOpen} toggle={handleModalClose} centered size="md">
      <ModalHeader toggle={handleModalClose}>
        <div className="d-flex align-items-center">
          <i className="fa fa-camera text-primary me-2" />
          <span>Quét Mã QR Truy Xuất Nguồn Gốc</span>
        </div>
      </ModalHeader>
      <ModalBody>
        {/* Navigation Tabs */}
        <div className="d-flex justify-content-center border-bottom pb-2 mb-3">
          <Button
            color={activeTab === 'camera' ? 'primary' : 'light'}
            size="sm"
            className="me-2"
            onClick={() => setActiveTab('camera')}
          >
            <i className="fa fa-video-camera me-1" /> Dùng Camera
          </Button>
          <Button
            color={activeTab === 'file' ? 'primary' : 'light'}
            size="sm"
            className="me-2"
            onClick={() => {
              stopCamera();
              setActiveTab('file');
            }}
          >
            <i className="fa fa-image me-1" /> Tải Ảnh QR
          </Button>
          <Button
            color={activeTab === 'manual' ? 'primary' : 'light'}
            size="sm"
            onClick={() => {
              stopCamera();
              setActiveTab('manual');
            }}
          >
            <i className="fa fa-keyboard-o me-1" /> Nhập Mã ID
          </Button>
        </div>

        {/* Tab 1: Live Camera */}
        {activeTab === 'camera' && (
          <div className="text-center">
            {cameraError ? (
              <div className="alert alert-warning py-3">
                <i className="fa fa-info-circle me-1" /> {cameraError}
                <div className="mt-2">
                  <Button size="sm" color="secondary" onClick={() => setActiveTab('file')}>
                    Tải ảnh tem có sẵn
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-muted small mb-2">
                  Hướng camera về phía mã QR trên bao bì sản phẩm:
                </p>
                <div
                  id="qr-reader-container"
                  style={{
                    width: '100%',
                    maxWidth: '350px',
                    margin: '0 auto',
                    minHeight: '260px',
                    borderRadius: '8px',
                    overflow: 'hidden',
                  }}
                />
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Upload File */}
        {activeTab === 'file' && (
          <div className="text-center py-3">
            <i className="fa fa-file-image-o fa-3x text-muted mb-3" />
            <p className="text-muted small">
              Chọn ảnh tem nhãn có chứa mã QR truy xuất sản phẩm từ thư viện ảnh hoặc máy tính:
            </p>
            <Input
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="mt-2 mx-auto"
              style={{ maxWidth: '300px' }}
            />
            <div id="file-qr-temp" style={{ display: 'none' }} />
          </div>
        )}

        {/* Tab 3: Manual Input */}
        {activeTab === 'manual' && (
          <div className="py-2">
            <p className="text-muted small">
              Nhập mã số định danh in bên dưới tem QR trên bao bì:
            </p>
            <form onSubmit={handleManualSubmit}>
              <InputGroup>
                <Input
                  type="text"
                  placeholder="Ví dụ: 1, 2, 1001..."
                  value={manualId}
                  onChange={(e) => setManualId(e.target.value)}
                  autoFocus
                />
                <Button color="primary" type="submit">
                  Xác Nhận
                </Button>
              </InputGroup>
            </form>
          </div>
        )}
      </ModalBody>
      <ModalFooter className="border-top-0 pt-0">
        <Button color="secondary" outline size="sm" onClick={handleModalClose}>
          Đóng
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default QRScannerModal;
