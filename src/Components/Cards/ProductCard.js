import { useState } from 'react';
import { Button } from 'reactstrap';
import product_default from '../../Assests/Images/product_default.jpg';
import Rating from '../Rating';
import QRCodeModal from '../Modals/QRCodeModal';

const ProductCard = ({product}) => {
  const [isQRModalOpen, setIsQRModalOpen] = useState(false);

  const toggleQRModal = (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    setIsQRModalOpen(!isQRModalOpen);
  };

  return (
    <div className="my-1">
      <div className="row d-flex justify-content-around align-items-center">
        <div className="col-12 col-md-4">
          <img 
            src={product.item["image_url"] || product_default}
            width="100%"
            alt={product.item["title"]}
            onError={(e) => { e.target.src = product_default; }}
          />
        </div>
        <div className="col-12 col-md-8">
          <span className="card-key">Id: </span>
          <span className="card-value">{product.item["id"]}</span>
          <br/>
          <span className="card-key">Name: </span>
          <span className="card-value">{product.item["title"]}</span>
          <br/>
          <span className="card-key">Manufacturer: </span>
          <span className="card-value">{product.manufacturer ? product.manufacturer["name"] : "N/A"}</span>
          <br/>
          <span className='d-flex align-items-center'>
            <span className="card-key">Rating: </span> &nbsp;
            <Rating rating={product.item["rating"]/20} editable={false}/>
          </span>
          <br/>
          <div className="d-flex justify-content-between align-items-center flex-wrap gap-1">
            <span className="d-flex gap-1">
              {product.manufacturer && product.manufacturer.isVerified?
                <span className="badge bg-success">Verified</span>
              :
                <span className="badge bg-warning">Not Verified</span>
              }
              {product.manufacturer && product.manufacturer.isRenewableUsed?
                <span className="badge bg-success">Eco Friendly</span>
              :
                <span className="badge bg-warning">Non Eco Friendly</span>
              }
            </span>
            <Button
              color="warning"
              size="sm"
              className="py-1 px-2 fw-bold text-dark"
              onClick={toggleQRModal}
              title="Xem và tải tem QR truy xuất"
            >
              <i className="fa fa-qrcode me-1" /> Tem QR
            </Button>
          </div>
        </div>
      </div>
      <hr/>

      <QRCodeModal
        isOpen={isQRModalOpen}
        toggle={toggleQRModal}
        productId={product.item["id"]}
        productTitle={product.item["title"]}
        productImage={product.item["image_url"]}
        manufacturerName={product.manufacturer ? product.manufacturer["name"] : ""}
        launchDate={product.item["launchDate"]}
      />
    </div>
  )
}
export default ProductCard;