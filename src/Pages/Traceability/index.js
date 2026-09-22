import React, { useContext, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Input, InputGroup, Badge, Spinner } from 'reactstrap';
import { AuthContext } from '../../Services/Contexts/AuthContext';
import { ContractContext } from '../../Services/Contexts/ContractContext';
import { fetchManufacturer, formattedAddress } from '../../Services/Utils/stakeholder';
import Rating from '../../Components/Rating';
import QRCodeModal from '../../Components/Modals/QRCodeModal';
import QRScannerModal from '../../Components/Modals/QRScannerModal';
import Toast from '../../Components/Toast';
import defaultProductImg from '../../Assests/Images/product_default.jpg';
import '../../Assests/Styles/traceability.page.css';

const Traceability = () => {
  const { id: urlId } = useParams();
  const navigate = useNavigate();
  const { authState } = useContext(AuthContext);
  const { contractState } = useContext(ContractContext);

  const [searchId, setSearchId] = useState(urlId || "");
  const [loading, setLoading] = useState(false);
  const [productData, setProductData] = useState(null);
  const [historyRecords, setHistoryRecords] = useState([]);
  const [notFound, setNotFound] = useState(false);

  // Modals
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);

  const toggleQRModal = () => setIsQRModalOpen(!isQRModalOpen);
  const toggleScannerModal = () => setIsScannerModalOpen(!isScannerModalOpen);

  useEffect(() => {
    if (urlId) {
      setSearchId(urlId);
      loadProductTrace(urlId);
    } else {
      setProductData(null);
      setNotFound(false);
    }
  }, [urlId, contractState.productContract]);

  const loadProductTrace = async (idToQuery) => {
    if (!idToQuery) return;
    if (!contractState.productContract) {
      return;
    }

    setLoading(true);
    setNotFound(false);
    try {
      const response = await contractState.productContract.methods.get(idToQuery).call();
      
      // Check if product exists (manufacturer should not be address(0))
      if (
        !response.item || 
        response.item.manufacturer === "0x0000000000000000000000000000000000000000" ||
        (response.item.id === "0" && response.item.title === "")
      ) {
        setNotFound(true);
        setProductData(null);
        setLoading(false);
        return;
      }

      let manufacturer = null;
      if (contractState.manufacturerContract) {
        try {
          manufacturer = await fetchManufacturer(
            authState.address,
            contractState.manufacturerContract,
            response.item.manufacturer
          );
        } catch (e) {
          console.warn("Could not fetch manufacturer details:", e);
        }
      }

      let history = [];
      try {
        if (contractState.productContract.methods.getProductHistory) {
          history = await contractState.productContract.methods.getProductHistory(idToQuery).call();
        }
      } catch (e) {
        console.warn("Could not fetch on-chain history records:", e);
      }

      setProductData({
        item: response.item,
        rawProducts: response.rawProducts || [],
        transactions: response.transactions || [],
        reviews: response.reviews || [],
        manufacturer: manufacturer || {
          name: "Nhà sản xuất đã đăng ký",
          formattedAddress: formattedAddress(response.item.manufacturer),
          location: "Chưa xác định",
          isVerified: true,
          isRenewableUsed: false
        }
      });
      setHistoryRecords(history);
      setNotFound(false);
    } catch (err) {
      console.error("Lỗi tra cứu thông tin sản phẩm:", err);
      setNotFound(true);
      setProductData(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchId.trim()) {
      Toast("error", "Vui lòng nhập mã sản phẩm!");
      return;
    }
    navigate(`/trace/${searchId.trim()}`);
  };

  const handleScanSuccess = (scannedId) => {
    setSearchId(scannedId);
    navigate(`/trace/${scannedId}`);
  };

  return (
    <div className="trace-container">
      {/* Search Bar & Actions */}
      <div className="trace-search-box">
        <div className="row align-items-center">
          <div className="col-12 col-md-7 mb-2 mb-md-0">
            <form onSubmit={handleSearch}>
              <InputGroup>
                <Input
                  placeholder="Nhập mã sản phẩm (ID / Serial Number)..."
                  value={searchId}
                  onChange={(e) => setSearchId(e.target.value)}
                />
                <Button color="primary" type="submit">
                  <i className="fa fa-search me-1" /> Tra Cứu
                </Button>
              </InputGroup>
            </form>
          </div>
          <div className="col-12 col-md-5 text-md-end text-center">
            <Button color="success" onClick={toggleScannerModal} className="me-2">
              <i className="fa fa-qrcode me-1" /> Quét Mã QR
            </Button>
            {productData && (
              <Button color="warning" onClick={toggleQRModal}>
                <i className="fa fa-print me-1" /> Xem / In Tem QR
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center my-5 py-5">
          <Spinner color="primary" style={{ width: '3rem', height: '3rem' }} />
          <div className="mt-3 text-muted fw-bold">
            Đang tra cứu dữ liệu gốc từ Blockchain Ethereum...
          </div>
        </div>
      )}

      {/* Not Found State */}
      {!loading && notFound && (
        <div className="trace-card text-center py-5">
          <i className="fa fa-exclamation-triangle text-danger fa-4x mb-3" />
          <h4 className="fw-bold text-danger">Không Tìm Thấy Mã Sản Phẩm #{urlId}</h4>
          <p className="text-muted mx-auto" style={{ maxWidth: '500px' }}>
            Không tìm thấy thông tin xác thực của sản phẩm này trên chuỗi khối Blockchain.
            Vui lòng kiểm tra lại mã tem hoặc quét lại mã QR trên bao bì.
          </p>
          <Button color="primary" outline onClick={toggleScannerModal}>
            <i className="fa fa-camera me-1" /> Quét lại mã QR
          </Button>
        </div>
      )}

      {/* Default Prompt when no ID is provided */}
      {!loading && !urlId && !productData && (
        <div className="trace-card text-center py-5">
          <i className="fa fa-qrcode text-primary fa-4x mb-3" />
          <h3 className="fw-bold">Cổng Truy Xuất Nguồn Gốc Thực Phẩm Blockchain</h3>
          <p className="text-muted mx-auto mb-4" style={{ maxWidth: '600px' }}>
            Hệ thống đảm bảo tính minh bạch tuyệt đối: kiểm chứng nguồn gốc nông trại,
            nhà sản xuất, các mốc luân chuyển và chứng nhận an toàn thực phẩm bất biến trên chuỗi khối Ethereum.
          </p>
          <div className="d-flex justify-content-center gap-3">
            <Button color="success" size="lg" onClick={toggleScannerModal}>
              <i className="fa fa-camera me-2" /> Bật Camera Quét Mã QR
            </Button>
          </div>
        </div>
      )}

      {/* Product Details & Traceability Report */}
      {!loading && productData && (
        <>
          {/* Header Banner */}
          <div className="trace-hero-banner">
            <div className="row align-items-center">
              <div className="col-12 col-md-8">
                <div className="trace-verified-tag mb-2">
                  <i className="fa fa-check-circle" /> Xác thực nguồn gốc trên Blockchain
                </div>
                <h2 className="fw-bold mb-1">{productData.item.title}</h2>
                <div className="text-light opacity-75 mb-2">
                  Mã định danh sản phẩm: <strong>#{productData.item.id}</strong> &bull; 
                  Xuất xưởng: {new Date(productData.item.launchDate * 1000).toLocaleDateString()}
                </div>
                <div className="trace-contract-badge">
                  Hợp đồng thông minh: {contractState.productContract ? formattedAddress(contractState.productContract._address) : "0xProductContract"}
                </div>
              </div>
              <div className="col-12 col-md-4 text-md-end text-center mt-3 mt-md-0">
                <Button color="light" className="fw-bold text-dark px-3 py-2 shadow-sm" onClick={toggleQRModal}>
                  <i className="fa fa-qrcode text-primary me-2 fa-lg" />
                  Mã QR Sản Phẩm
                </Button>
              </div>
            </div>
          </div>

          <div className="row">
            {/* Left Column: Product & Manufacturer */}
            <div className="col-12 col-lg-5">
              {/* Product Basic Info Card */}
              <div className="trace-card">
                <div className="trace-section-title">
                  <i className="fa fa-cube" /> Thông Tin Sản Phẩm
                </div>
                <img
                  src={productData.item.image_url || defaultProductImg}
                  alt={productData.item.title}
                  className="trace-product-img mb-3"
                  onError={(e) => { e.target.src = defaultProductImg; }}
                />
                <div className="trace-meta-item">
                  <span className="trace-meta-label">Tên sản phẩm:</span>
                  <span className="trace-meta-val">{productData.item.title}</span>
                </div>
                <div className="trace-meta-item">
                  <span className="trace-meta-label">Mã ID (Serial):</span>
                  <span className="trace-meta-val">#{productData.item.id}</span>
                </div>
                <div className="trace-meta-item">
                  <span className="trace-meta-label">Đánh giá chung:</span>
                  <span className="trace-meta-val d-flex align-items-center">
                    <Rating rating={productData.item.rating / 20} editable={false} />
                    <span className="ms-2 text-muted small">
                      ({productData.reviews.length} đánh giá)
                    </span>
                  </span>
                </div>
                <div className="trace-meta-item">
                  <span className="trace-meta-label">Chủ sở hữu hiện tại:</span>
                  <span className="trace-meta-val font-monospace text-primary">
                    {formattedAddress(productData.item.currentOwner)}
                  </span>
                </div>
              </div>

              {/* Manufacturer Profile Card */}
              <div className="trace-card">
                <div className="trace-section-title">
                  <i className="fa fa-industry" /> Đơn Vị Sản Xuất
                </div>
                <div className="trace-meta-item">
                  <span className="trace-meta-label">Doanh nghiệp:</span>
                  <span className="trace-meta-val fw-bold text-dark">
                    {productData.manufacturer.name}
                  </span>
                </div>
                <div className="trace-meta-item">
                  <span className="trace-meta-label">Địa chỉ trụ sở:</span>
                  <span className="trace-meta-val">
                    {productData.manufacturer.location || "N/A"}
                  </span>
                </div>
                <div className="trace-meta-item">
                  <span className="trace-meta-label">Địa chỉ ví blockchain:</span>
                  <span className="trace-meta-val font-monospace">
                    {formattedAddress(productData.item.manufacturer)}
                  </span>
                </div>
                <div className="mt-3 d-flex gap-2 flex-wrap">
                  {productData.manufacturer.isVerified ? (
                    <Badge color="success" className="p-2">
                      <i className="fa fa-check-circle me-1" /> Đã Kiểm Định Doanh Nghiệp
                    </Badge>
                  ) : (
                    <Badge color="warning" className="p-2">
                      <i className="fa fa-clock-o me-1" /> Chờ Phê Duyệt
                    </Badge>
                  )}
                  {productData.manufacturer.isRenewableUsed ? (
                    <Badge color="info" className="p-2">
                      <i className="fa fa-leaf me-1" /> Tiêu Chuẩn Xanh (Eco-Friendly)
                    </Badge>
                  ) : (
                    <Badge color="secondary" className="p-2">
                      Tiêu Chuẩn Thường
                    </Badge>
                  )}
                </div>
              </div>

              {/* Raw Ingredients Origin Card */}
              <div className="trace-card">
                <div className="trace-section-title">
                  <i className="fa fa-leaf" /> Nguồn Gốc Nguyên Liệu Nông Trại
                </div>
                {productData.rawProducts.length === 0 ? (
                  <p className="text-muted small">Không có thông tin nguyên liệu thô kèm theo.</p>
                ) : (
                  <div>
                    {productData.rawProducts.map((raw, idx) => (
                      <div key={idx} className="ingredient-badge">
                        <div>
                          <strong className="text-dark">{raw.name}</strong>
                        </div>
                        <div>
                          {raw.isVerified ? (
                            <span className="badge bg-success">
                              <i className="fa fa-check me-1" /> Xuất xứ chuẩn
                            </span>
                          ) : (
                            <span className="badge bg-warning text-dark">
                              Chưa kiểm định
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Timeline & Transactions */}
            <div className="col-12 col-lg-7">
              {/* Supply Chain Timeline Card */}
              <div className="trace-card">
                <div className="trace-section-title">
                  <i className="fa fa-road" /> Hành Trình Chuỗi Cung Ứng (Supply Chain Journey)
                </div>
                <p className="text-muted small mb-3">
                  Từng bước chuyển giao quyền sở hữu và xuất xưởng được ký nhận bất biến bởi smart contract:
                </p>

                <div className="timeline-container">
                  {/* Step 1: Nông trại & Nguyên liệu */}
                  <div className="timeline-step">
                    <div className="timeline-icon-dot dot-harvest">
                      <i className="fa fa-tree" />
                    </div>
                    <div className="timeline-content-card">
                      <div className="timeline-step-title">Thu hoạch & Cung ứng Nguyên liệu</div>
                      <div className="timeline-step-date">
                        Từ mạng lưới nông dân đã đăng ký với hệ thống
                      </div>
                      <p className="timeline-step-desc">
                        Các nguyên liệu ({productData.rawProducts.map(r => r.name).join(', ') || 'Nông sản'})
                        được tiếp nhận và kiểm định trước khi đưa vào dây chuyền sản xuất.
                      </p>
                    </div>
                  </div>

                  {/* Step 2: Nhà máy chế biến */}
                  <div className="timeline-step">
                    <div className="timeline-icon-dot dot-manufacture">
                      <i className="fa fa-industry" />
                    </div>
                    <div className="timeline-content-card">
                      <div className="timeline-step-title">Chế Biến & Xuất Xưởng Sản Phẩm</div>
                      <div className="timeline-step-date">
                        {new Date(productData.item.launchDate * 1000).toLocaleString()}
                      </div>
                      <p className="timeline-step-desc">
                        Sản xuất bởi <strong>{productData.manufacturer.name}</strong>. Gán mã định danh
                        duy nhất #{productData.item.id} và kích hoạt tem truy xuất nguồn gốc QR.
                      </p>
                    </div>
                  </div>

                  {/* Step 3: Các giao dịch chuyển giao (Transactions) */}
                  {productData.transactions.map((tx, index) => (
                    <div key={index} className="timeline-step">
                      <div className="timeline-icon-dot dot-transfer">
                        <i className="fa fa-truck" />
                      </div>
                      <div className="timeline-content-card">
                        <div className="timeline-step-title">
                          Chuyển Giao Quyền Sở Hữu #{index + 1}
                        </div>
                        <div className="timeline-step-date">
                          {new Date(tx.date * 1000).toLocaleString()}
                        </div>
                        <p className="timeline-step-desc font-monospace small">
                          <span className="text-secondary">Từ:</span> {formattedAddress(tx.from)}
                          <br/>
                          <span className="text-secondary">Tới:</span> {formattedAddress(tx.to)}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Step 4: Chủ sở hữu hiện tại */}
                  <div className="timeline-step">
                    <div className="timeline-icon-dot dot-owner">
                      <i className="fa fa-shopping-bag" />
                    </div>
                    <div className="timeline-content-card">
                      <div className="timeline-step-title">Vị Trí / Người Sở Hữu Hiện Tại</div>
                      <div className="timeline-step-date">Hiện diện trên thị trường</div>
                      <p className="timeline-step-desc font-monospace small text-primary">
                        Đang được lưu giữ / sở hữu bởi ví: {formattedAddress(productData.item.currentOwner)}
                      </p>
                    </div>
                  </div>
                </div>

                {historyRecords && historyRecords.length > 0 && (
                  <div className="mt-3 pt-3 border-top">
                    <div className="small fw-bold text-muted text-uppercase mb-2">
                      <i className="fa fa-database me-1" /> Bản ghi lịch sử Smart Contract (History Records):
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {historyRecords.map((hr, hIdx) => (
                        <span key={hIdx} className="badge bg-secondary font-monospace" style={{ fontSize: '11px' }}>
                          {hr.action}: {formattedAddress(hr.actor)} ({new Date(hr.timestamp * 1000).toLocaleTimeString()})
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Reviews Card */}
              <div className="trace-card">
                <div className="trace-section-title">
                  <i className="fa fa-comments" /> Đánh Giá Từ Người Mua Đã Xác Thực
                </div>
                {productData.reviews.length === 0 ? (
                  <p className="text-muted small">Sản phẩm chưa có đánh giá nào trên blockchain.</p>
                ) : (
                  <div>
                    {productData.reviews.map((rev, index) => (
                      <div key={index} className="review-item">
                        <div className="d-flex justify-content-between align-items-center mb-1">
                          <Rating rating={rev.rating / 20} editable={false} />
                          <span className="badge bg-success" style={{ fontSize: '10px' }}>
                            <i className="fa fa-check me-1" /> Verified Buyer
                          </span>
                        </div>
                        <div className="small text-muted mb-1">
                          Người mua: <span className="font-monospace">{formattedAddress(rev.reviewer)}</span> &bull; 
                          Ngày: {new Date(rev.date * 1000).toLocaleDateString()}
                        </div>
                        <p className="mb-0 text-dark small">{rev.comment}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Modals */}
          <QRCodeModal
            isOpen={isQRModalOpen}
            toggle={toggleQRModal}
            productId={productData.item.id}
            productTitle={productData.item.title}
            productImage={productData.item.image_url}
            manufacturerName={productData.manufacturer.name}
            launchDate={productData.item.launchDate}
          />
        </>
      )}

      {/* QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerModalOpen}
        toggle={toggleScannerModal}
        onScanSuccess={handleScanSuccess}
      />
    </div>
  );
};

export default Traceability;
