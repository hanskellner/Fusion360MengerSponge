// Menger Sponge
//
// Generate a Menger Sponge
// See: https://en.wikipedia.org/wiki/Menger_sponge
//
// Based on various implementations and then cobbled together
//
// Usage:
//    var sponge = new MengerSpongeGenerator();
//    sponge.generate(4);   // level 4 menger sponge

var MAX_MENGER_LEVEL = 5; // the max level of menger sponge

MengerSpongeGenerator = function () {
    this._cache = [];
    this._size = 0;
    this._level = 0;
    this._blocks = null;
};

MengerSpongeGenerator.prototype = {

	//// Public

    generate: function(level) {
        if (level < 0 || level > MAX_MENGER_LEVEL) {
            return false;
        }
        this.init(level);

        return this.doGenerate();
    },

    // Returns the size used for each dimension X,Y,Z
    size: function() {
        return this._size;
    },

    // Return true if block is set; otherwise false
    getBlock: function(x,y,z) {
        if (x < 0 || x >= this._size || y < 0 || y >= this._size || z < 0 || z >= this._size ) {
            return false;   // invalid
        }

        // return bool for this coord
        var zBitArray = this._blocks[x + y*this._size];
        return zBitArray.get(z);
    },

    // Set or clear a block at specified XYZ
    // @param {Boolean} flag
    setBlock: function(x,y,z, flag) {
        if (x < 0 || x >= this._size || y < 0 || y >= this._size || z < 0 || z >= this._size ) {
            return;   // invalid
        }

        // return bool for this coord
        var zBitArray = this._blocks[x + y*this._size];
        zBitArray.set(z, flag);
    },

	//// Private
    init: function(level) {
        this._size = Math.pow(3,level);
        this._cache = [];
        for (var iMod = 0; iMod < this._size; iMod++) {
            this._cache.push(0);
        }
        this._level = level;

        // Holds the blocks using 2D array of bit arrays for Z
        this._blocks = [];
        for (var x = 0; x < this._size; x++) {
            for (var y = 0; y < this._size; y++) {
                this._blocks[x + y*this._size] = new BitArray(this._size);
            }
        }
    },

	doGenerate: function() {
        if (this._cache.length === 0) {
            return false;
        }
        var e1, e2, e3, t;
        for (var n = 1; n <= this._level ; n++) {
            e1 = Math.pow(3,n-1);
            e2 = e1 * 3;
            e3 = e1 * 2;
            for (var i = 0 ; i < this._size ; i++) {
                t = i % e2;
                this._cache[i] = (e1 <= t) && (t < e3) ? 1 : 0;
            }

            for (var x = 0 ; x < this._size ; x++) {
                for (var y = 0 ; y < this._size ; y++) {
                    for (var z = 0 ; z < this._size ; z++) {
                        if ( this._cache[x] + this._cache[y] + this._cache[z] > 1) {
                            this._blocks[x + y*this._size].set(z, false);
                        } else  if (n == 1) {
                            this._blocks[x + y*this._size].set(z, true);
                        }
                    }
                }
            }
        }

        return true;
	}
};
