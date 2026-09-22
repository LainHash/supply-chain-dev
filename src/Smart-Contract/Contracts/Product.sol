// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title Product
 * @dev Core supply-chain product contract.
 *
 * Preserved interfaces (used by setup-app.js, ContractContext.js, and product.js frontend):
 *  - add(id, title, rawProducts[], image_url)
 *  - get(id) -> (Item, Transaction[], Review[], RawProduct[])
 *  - transfer(to, id)
 *  - addReview(id, rating, comment)
 *  - getItemIds()
 *  - getProductsCount()
 *  - getTransactionsCount()
 *  - getReviewsCount()
 *
 * Added / completed for requirements:
 *  - addProduct(serialNo, title, rawProducts[], {from}) — test alias
 *  - getProduct(serialNo) — test alias returning flat struct with isValue flag
 *  - updateOwnership(to, serialNo) — test alias for transfer()
 *  - getProductHistory(id) — returns the on-chain history records
 *
 * Product History:
 *  Each product has an array of HistoryRecord entries that is written
 *  automatically by add(), transfer(), and addReview().  History is append-only.
 *
 * Events:
 *  - ProductCreated(id, title, manufacturer)
 *  - ProductTransferred(id, from, to)
 *  - ProductReviewed(id, reviewer, rating)
 *  - ProductHistoryAdded(id, actor, action)
 */
contract Product {

    // ─── Structs ───────────────────────────────────────────────────────────────

    struct Transaction {
        uint256 txId;
        address from;
        address to;
        uint    date;
    }

    struct Review {
        uint256 id;
        uint    date;
        uint256 rating;
        string  comment;
        address reviewer;
    }

    struct RawProduct {
        string name;
        bool   isVerified;
    }

    struct Item {
        uint256 id;
        string  title;
        address manufacturer;
        address currentOwner;
        address lastOwner;
        uint256 rating;
        uint    launchDate;
        string  image_url;
    }

    /**
     * @dev Lightweight history record stored per-product.
     *      `action` uses short, fixed strings to keep gas costs down.
     *      Possible values: "CREATED", "TRANSFERRED", "REVIEWED"
     */
    struct HistoryRecord {
        uint    timestamp;
        address actor;
        string  action;
        string  detail;   // e.g. "to:<address>" or "rating:<n>"
    }

    /**
     * @dev Flat struct returned by getProduct() for test compatibility.
     *      `isValue` is true when the product exists.
     */
    struct ProductInfo {
        uint256 id;
        string  title;
        address manufacturer;
        address ownership;   // currentOwner
        bool    isValue;
    }

    // ─── Storage ───────────────────────────────────────────────────────────────

    uint256[]                          public  _itemIds;
    mapping(uint256 => Item)           public  _items;
    mapping(uint256 => Review)                 _reviews;
    mapping(uint256 => Transaction)            _transactions;

    mapping(uint256 => uint256[])              _itemTransactions;
    mapping(uint256 => uint256[])              _itemReviews;
    mapping(uint256 => RawProduct[])           _itemRawProducts;
    mapping(uint256 => HistoryRecord[])        _productHistory;
    mapping(uint256 => bool)                   _productExists;

    uint256 _nextTransactionId;
    uint256 _nextReviewId;

    // ─── Events ────────────────────────────────────────────────────────────────

    event ProductCreated(uint256 indexed id, string title, address indexed manufacturer);
    event ProductTransferred(uint256 indexed id, address indexed from, address indexed to);
    event ProductReviewed(uint256 indexed id, address indexed reviewer, uint256 rating);
    event ProductHistoryAdded(uint256 indexed id, address indexed actor, string action);

    // ─── Constructor ───────────────────────────────────────────────────────────

    constructor() {
        _nextTransactionId = 0;
        _nextReviewId      = 0;
    }

    // ─── Modifiers ─────────────────────────────────────────────────────────────

    modifier productExists(uint256 _id) {
        require(_productExists[_id], "Product: product does not exist");
        _;
    }

    modifier onlyCurrentOwner(uint256 _id) {
        require(
            _items[_id].currentOwner == msg.sender,
            "Product: caller is not the current owner"
        );
        _;
    }

    // ─── Write functions ───────────────────────────────────────────────────────

    /**
     * @notice Create a new product in the system.
     * @dev Preserved signature; called by LaunchProduct.js and setup-app.js.
     */
    function add(
        uint256          _id,
        string  memory   _title,
        RawProduct[] memory _rawProducts,
        string  memory   _image_url
    ) public returns (bool) {
        require(msg.sender != address(0),  "Product::add: manufacturer cannot be zero address");
        require(bytes(_title).length > 0,  "Product::add: title cannot be empty");
        require(!_productExists[_id],      "Product::add: product id already exists");

        address _manufacturer = msg.sender;

        _items[_id] = Item({
            id:           _id,
            title:        _title,
            manufacturer: _manufacturer,
            currentOwner: _manufacturer,
            lastOwner:    address(0),
            rating:       0,
            launchDate:   block.timestamp,
            image_url:    _image_url
        });

        for (uint i = 0; i < _rawProducts.length; i++) {
            _itemRawProducts[_id].push(_rawProducts[i]);
        }

        _itemIds.push(_id);
        _productExists[_id] = true;

        // Record history
        _appendHistory(_id, _manufacturer, "CREATED", _title);

        emit ProductCreated(_id, _title, _manufacturer);
        emit ProductHistoryAdded(_id, _manufacturer, "CREATED");
        return true;
    }

    /**
     * @notice Test-compatible alias for add().
     * @dev Tests call: addProduct(serialNo, title, rawProductNames[], {from}).
     *      Accepts plain string[] instead of RawProduct[] for simplicity.
     */
    function addProduct(
        uint256        _id,
        string memory  _title,
        string[] memory _rawProductNames
    ) public returns (bool) {
        RawProduct[] memory rp = new RawProduct[](_rawProductNames.length);
        for (uint i = 0; i < _rawProductNames.length; i++) {
            rp[i] = RawProduct(_rawProductNames[i], false);
        }
        return add(_id, _title, rp, "");
    }

    /**
     * @notice Transfer product ownership to `_to`.
     * @dev Preserved signature (called by product.js frontend and setup-app.js).
     */
    function transfer(
        address _to,
        uint256 _id
    ) public productExists(_id) onlyCurrentOwner(_id) returns (bool) {
        require(_to != address(0),               "Product::transfer: cannot transfer to zero address");
        require(_items[_id].currentOwner != _to, "Product::transfer: cannot transfer to self");

        address _from = _items[_id].currentOwner;
        _items[_id].lastOwner    = _from;
        _items[_id].currentOwner = _to;

        _transactions[_nextTransactionId] = Transaction({
            txId: _nextTransactionId,
            from: _from,
            to:   _to,
            date: block.timestamp
        });
        _itemTransactions[_id].push(_nextTransactionId);
        _nextTransactionId++;

        // Record history
        string memory detail = string(abi.encodePacked("to:", _addressToString(_to)));
        _appendHistory(_id, _from, "TRANSFERRED", detail);

        emit ProductTransferred(_id, _from, _to);
        emit ProductHistoryAdded(_id, _from, "TRANSFERRED");
        return true;
    }

    /**
     * @notice Test-compatible alias: updateOwnership(to, serialNo).
     */
    function updateOwnership(address _to, uint256 _id) public returns (bool) {
        return transfer(_to, _id);
    }

    /**
     * @notice Post a review on a product. Caller must be the current owner.
     * @dev Preserved signature from original implementation.
     */
    function addReview(
        uint256       _id,
        uint256       _rating,
        string memory _comment
    ) public productExists(_id) onlyCurrentOwner(_id) returns (bool) {
        require(_rating <= 100, "Product::addReview: rating must be 0-100");

        _reviews[_nextReviewId] = Review({
            id:       _nextReviewId,
            date:     block.timestamp,
            rating:   _rating,
            comment:  _comment,
            reviewer: msg.sender
        });

        // Cumulative moving average for rating
        uint256 currentCount = _itemReviews[_id].length;
        _items[_id].rating = (_items[_id].rating * currentCount + _rating) / (currentCount + 1);
        _itemReviews[_id].push(_nextReviewId);
        _nextReviewId++;

        // Record history
        string memory detail = string(abi.encodePacked("rating:", _uint256ToString(_rating)));
        _appendHistory(_id, msg.sender, "REVIEWED", detail);

        emit ProductReviewed(_id, msg.sender, _rating);
        emit ProductHistoryAdded(_id, msg.sender, "REVIEWED");
        return true;
    }

    // ─── Read functions ────────────────────────────────────────────────────────

    /**
     * @notice Full product data including all transactions, reviews, and raw products.
     * @dev Preserved signature used by ContractContext.js and product.js frontend.
     */
    function get(uint256 _id) public view returns (
        Item         memory item,
        Transaction[] memory transactions,
        Review[]      memory reviews,
        RawProduct[]  memory rawProducts
    ) {
        item = _items[_id];

        transactions = new Transaction[](_itemTransactions[_id].length);
        for (uint256 i = 0; i < _itemTransactions[_id].length; i++) {
            transactions[i] = _transactions[_itemTransactions[_id][i]];
        }

        reviews = new Review[](_itemReviews[_id].length);
        for (uint256 i = 0; i < _itemReviews[_id].length; i++) {
            reviews[i] = _reviews[_itemReviews[_id][i]];
        }

        rawProducts = _itemRawProducts[_id];
    }

    /**
     * @notice Test-compatible retrieval returning a flat ProductInfo struct.
     * @dev Tests check: product.isValue == true/false; product.ownership == address.
     *      Uses uint256 id (tests pass productSerialNo = "123456" as a uint).
     */
    function getProduct(uint256 _id) public view returns (ProductInfo memory info) {
        if (!_productExists[_id]) {
            info.isValue = false;
            return info;
        }
        Item memory item = _items[_id];
        info = ProductInfo({
            id:           item.id,
            title:        item.title,
            manufacturer: item.manufacturer,
            ownership:    item.currentOwner,
            isValue:      true
        });
    }

    /**
     * @notice Returns the complete on-chain history for a product.
     * @dev History is append-only and recorded automatically; cannot be forged.
     */
    function getProductHistory(uint256 _id) public view returns (HistoryRecord[] memory) {
        require(_productExists[_id], "Product::getProductHistory: product does not exist");
        return _productHistory[_id];
    }

    /**
     * @notice Returns all product IDs ever registered.
     */
    function getItemIds() public view returns (uint256[] memory) {
        return _itemIds;
    }

    /// @notice Total number of products.
    function getProductsCount() public view returns (uint256) {
        return _itemIds.length;
    }

    /// @notice Total number of transfer transactions.
    function getTransactionsCount() public view returns (uint256) {
        return _nextTransactionId;
    }

    /// @notice Total number of reviews.
    function getReviewsCount() public view returns (uint256) {
        return _nextReviewId;
    }

    // ─── Internal helpers ──────────────────────────────────────────────────────

    function _appendHistory(
        uint256       _id,
        address       _actor,
        string memory _action,
        string memory _detail
    ) internal {
        _productHistory[_id].push(HistoryRecord({
            timestamp: block.timestamp,
            actor:     _actor,
            action:    _action,
            detail:    _detail
        }));
    }

    /**
     * @dev Convert address to its hex string representation for history detail.
     *      Kept internal and minimal to avoid gas bloat.
     */
    function _addressToString(address _addr) internal pure returns (string memory) {
        bytes20 addrBytes = bytes20(_addr);
        bytes memory hex_chars = "0123456789abcdef";
        bytes memory result = new bytes(42);
        result[0] = "0";
        result[1] = "x";
        for (uint i = 0; i < 20; i++) {
            result[2 + i * 2]     = hex_chars[uint8(addrBytes[i] >> 4)];
            result[2 + i * 2 + 1] = hex_chars[uint8(addrBytes[i] & 0x0f)];
        }
        return string(result);
    }

    function _uint256ToString(uint256 _v) internal pure returns (string memory) {
        if (_v == 0) return "0";
        uint256 temp = _v;
        uint256 digits;
        while (temp != 0) { digits++; temp /= 10; }
        bytes memory buffer = new bytes(digits);
        while (_v != 0) {
            digits--;
            buffer[digits] = bytes1(uint8(48 + (_v % 10)));
            _v /= 10;
        }
        return string(buffer);
    }
}