/**
 * consistent-hash -- simple, quick, efficient hash ring (consistent hashing)
 *
 * Copyright (C) 2014-2015 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * - O(n log n) insert for any number of nodes, not O(n^2)
 * - fast js string hash computation
 * - fairly uniform hash distribution
 *
 * Based on my PHP version, see lib/Quick/Data/ConsistentHash.php
 * in https://github.com/andrasq/quicklib/
 */

function ConsistentHash( ) {
    this._nodeKeys = {}
    this._keyMap = {}
    this._keys = null
    this._keyCount = 0

    if (this._flip8Map[1] != 0x80) {
        var i, k
        for (i=0; i<256; i++) {
            function flipit(b1) {
                var k, bit, b2 = 0
                for (k=0; k<8; k++) {
                    bit = 1 << k
                    if (b1 & bit) b2 |= (1 << (7 - k))
                }
                return b2
            }
            this._flip8Map[i] = flipit(i)
        }
    }
}

ConsistentHash.prototype = {
    _nodeKeys: null,            // list of control points for each node
    _keyMap: null,              // control point to node map
    // sorted keys array will be regenerated whenever set to falsy
    _keys: null,                // array of sorted control points
    _range: 0x1000000,          // 24-bit hash range
    _flip8Map: new Array(256),  // flip the bits in byte, msb to lsb
    _flip4Map: [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15],

    /**
     * add n instances of the node at random positions around the hash ring
     */
    add:
    function add( node, n, points ) {
        var i, key
        n = n || 1
        if (Array.isArray(points)) points = this._copy(points)
        else points = this._makeControlPoints(n)
        nodeName = "" + node
        if (this._nodeKeys[nodeName]) for (i=0; i<n; i++) this._nodeKeys[nodeName].push(points[i])
        else this._nodeKeys[nodeName] = points
        for (i=0; i<n; i++) this._keyMap[points[i]] = node
        this._keys = null
        this._keyCount += n
        return this
    },

    _copy:
    function _copy( o ) {
        if (Array.isArray(o)) {
            var i, ret = new Array(o.length)
            for (i=0; i<o.length; i++) ret[i] = o[i]
            return ret
        }
        else {
            var k, ret = {}
            for (k in o) ret[k] = o[k]
            return ret
        }
    },

    _makeControlPoints:
    function _makeControlPoints( n ) {
        var i, points = new Array(n)
        for (i=0; i<n; i++) {
            // use probabilistic collision detection: ok for up to millions
            do {
                key = Math.random() * this._range >>> 0
            } while (this._keyMap[key] !== undefined || points[key] !== undefined)
            points[i] = key
        }
        return points
    },

    /**
     * remove all instances of the node from the hash ring
     */
    remove:
    function remove( node ) {
        var nodeName = "" + node
        if (this._nodeKeys[nodeName]) {
            var i, keys = this._nodeKeys[nodeName]
            for (i=0; i<keys.length; i++) delete this._keyMap[keys[i]]
            delete this._nodeKeys[nodeName]
            this._keys = null
            this._keyCount -= keys.length
        }
        return this
    },

    /**
     * return the first node in the hash ring after name
     */
    get:
    function get( name ) {
        if (!this._keys) this._buildKeys()
        if (!this._keyCount) return null
        var key = this._hash(name)
        //var index = this._absearch(this._keys, key)
// the lsbyte too closely tracks the input strings, eg a
// trailing decimal suffix 'a1234' skews the hash distribution.
// Drop a few of the least significant bits to counter this.
// Note: this makes 'a1', 'a2', 'a3' hash to the same node,
// but does not skip nodes 10-16 for strings /a[0-9]+/
key = key >>> 3
// FIXME: mod by a relative prime, to not set up beat patterns
var index = key % this._keyCount

//var index = ((key >>> 2) % this._keyCount)
//var index = ((key >>> 8) % this._keyCount)
//var index = ((key ^ (key >>> 5)) % this._keyCount)
//console.log("AR: idx", key.toString(16), this._keyCount, index)
        return this._keyMap[this._keys[index]]
    },

    /**
     * return the first n nodes in the hash ring after name
     */
/***
// FIXME: BROKEN: do not return n distinct, return the nodes of the next N control points for fall-through handling
    getMany:
    function getMany( name, n ) {
        if (!this._keys) this._buildKeys()
        var key = this._hash(name)
        var index = this._absearch(this._keys, key)
        if (index < 0) return []
        var i, foundKeys = {}, foundNodes = [], node
        function returnNodeAt( i ) {
            if (!foundKeys[this._keys[i]]) {
                foundKeys[this._keys[i]] = true
                foundNodes.push(this._keyMap[this._keys[i]])
            }
        }
        for (i=index; foundNodes.length < n && i<this._keys.length; i++) returnNodeAt(i)
        for (i=0; foundNodes.length < n && i<index; i++) returnNodeAt(i)
        return foundNodes
    },
***/

    // 24-bit PJW string hash
    _hash:
    function _pjwHash(s) {
        var len = s.length
        var g, h = 0
        for (var i=0; i<len; i++) {
            h = (h << 4) + s.charCodeAt(i)
            g = h & 0xf000000           // isolate high 4 bits
            if (g) {
                h ^= g                  // clear high 4 bits
                h ^= (g >>> 24)         // xor high 4 bits into low byte
            }
        }
        // for well distributed input, h has a good distribution in the lsb`s
        // but for correlated input eg /a[0-9]+/ it is skewed and caller must fix
        return h

        // h has a good distribution in the lsb`s,
        // need to move that to the msb`s, else all short strings
        // will map to bin[0].
// AR: do not flip if returning mod
//        var flip8 = this._flip8Map
//        h = (flip8[(h) & 0xff] << 16) | (flip8[(h >>> 8) & 0xff] << 8) | (flip8[(h >>> 16) & 0xff])
// the lsbyte too closely tracks the input strings, eg a
// trailing decimal suffix 'a1234' skews the hash distribution.
// Drop a few of the least significant bits to offset this.
//return h >>> 3
        return h
    },

    // compute an unsigned integer hash for the resource name
    _hash2:
    function _crcHash( s ) {
        // rotate left 5 bits, xor in each new byte
        // http://www.cs.hmc.edu/~geoff/classes/hmc.cs070.200101/homework10/hashfuncs.html
        var len = s.length
        var g, h = 0
        // TODO: speed up the hash computation for long strings
        // the hash does not have to be perfect, just well distributed
        for (var i=0; i<len; i++) {
            // 20-bit hash
            //g = h & 0xf8000
            //h = (((h & ~0xf8000) << 5) | (g >>> 15)) ^ s.charCodeAt(i)
            // 24-bit hash
            g = h & 0xf80000
            h = (((h & ~0xf80000) << 5) | (g >>> 19)) ^ s.charCodeAt(i)
            // 31-bit hash
            //g = h & 0x78000000
            //h = (((h & ~0x7800000) << 5) | (g >>> 26)) ^ s.charCodeAt(i)
        }
        // TODO: h has a good distribution in the lsb`s,
        // need to move that to the msb`s, else all short strings
        // will map to bin[0].  Extend 20-bit hash to 24-bit range
        var flip8 = this._flip8Map
        h = (flip8[(h) & 0xff] << 16) | (flip8[(h >>> 8) & 0xff] << 8) | (flip8[(h >>> 16) & 0xff])
// FIXME: distribution is not as uniform as one would expect...
        return h
    },

    // binary search the sorted array for the location of the key
    // returns the index of the first value >= key, or 0 if key > max(array)
    _absearch:
    function _absearch( array, key ) {
        var i, j, mid, gap = 10, len = array.length
        for (i=0, j=len-1; j - i > gap; ) {
            mid = (i + j) >>> 1
            if (array[mid] < key) i = mid + 1
            else j = mid
        }
        // faster to linear search once the location is narrowed to gap items
        for ( ; i<len; i++) if (array[i] >= key) return i
        return array.length === 0 ? -1 : 0
    },

    // regenerate the sorted keys array
    _buildKeys:
    function _buildKeys( ) {
        var i, j, nodeKeys, keys = new Array()
        for (i in this._nodeKeys) {
            nodeKeys = this._nodeKeys[i]
            for (j=0; j<nodeKeys.length; j++) {
                keys.push(nodeKeys[j])
            }
        }
        keys.sort(function(a,b){ return a - b })
        return this._keys = keys
    }
}

module.exports = ConsistentHash
