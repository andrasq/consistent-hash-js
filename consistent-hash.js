/**
 * consistent-hash -- simple, quick, efficient hash ring (consistent hashing)
 *
 * Copyright (C) 2014-2015,2021,2023 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * - O(n log n) insert for any number of nodes, not O(n^2)
 * - fast js string hash computation
 * - fairly uniform hash distribution
 *
 * Based on my PHP version, see lib/Quick/Data/ConsistentHash.php
 * in https://github.com/andrasq/quicklib/
 */

'use strict'

function ConsistentHash( options ) {
    this._nodes = new Array()
    this._nodeKeys = new Array()
    this._keyMap = {}
    this._keys = null
    this._needKeyMap = false
    this.nodeCount = 0
    this.keyCount = 0

    options = options || {}
    if (options.range) this._range = options.range
    if (options.controlPoints || options.weight) this._weightDefault = options.controlPoints || options.weight
    if (options.distribution === 'uniform') this._uniform = true
    if (options.orderNodes) this._orderNodes = options.orderNodes
}

ConsistentHash.prototype = {
    _nodes: null,               // list of node objects
    _nodeKeys: null,            // list of control points for each node, in nodes order
    _keyMap: null,              // control point to node map
    // sorted keys array will be regenerated whenever set to falsy
    _keys: null,                // array of sorted control points
    _range: 100003,             // hash ring capacity.  Smaller values (1k) distribute better (100k)
                                // ok values: 1009:1, 5003, 9127, 1000003:97
    _weightDefault: 40,         // number of control points to create per node
    _uniform: false,            // distribute nodes uniformly around the ring
    _needKeyMap: false,         // whether need to initialize on first use

    /**
     * add n instances of the node at random positions around the hash ring
     */
    add:
    function add( node, n, points ) {
        var i, key
        if (Array.isArray(points)) points = this._concat2(new Array(), points)
        else if (this._uniform) { this._needKeyMap = true; points = new Array(n || this._weightDefault) }
        else points = this._makeControlPoints(n || this._weightDefault)
        this._nodes.push(node)
        this._nodeKeys.push(points)
        n = points.length
        if (points[0] !== undefined) this._mapNodePoints(node, points)
        this._keys = null
        this.keyCount += n
        this.nodeCount += 1
        return this
    },

    _concat2:
    function _concat2( target, array ) {
        for (var i = 0; i < array.length; i++) target.push(array[i])
        return target
    },

    _makeControlPoints:
    function _makeControlPoints( n ) {
        var attemptCount = 0
        var i, key, points = new Array(n)
        for (i=0; i<n; i++) {
            // use probabilistic collision detection: ok for up to millions
            do {
                key = Math.random() * this._range >>> 0
            } while ((this._keyMap[key] !== undefined || points[key] === 'a') && ++attemptCount < 100)
            // adding the always-false ( == 'a') test above doubles throughput ??
            if (attemptCount >= 100) throw new Error("unable to find an unused control point, tried 100")
            // reuse control points after 1000 failed attempts.  This will shadow another node.
            points[i] = key
            // reserve the point to not reuse, not even for this node
            this._keyMap[key] = true
        }
        return points
    },

    /*
     * distribute n control points around the ring for each node that needs it, and update the keyMap
     */
    _buildKeyMap:
    function _buildKeyMap( n ) {
        var nodeCount = 0

        // count how many new nodes need uniformly distributed control points assigned
        var newNodes = {}
        for (var i = 0; i < this._nodes.length; i++) if (this._nodeKeys[i][0] === undefined) newNodes[i] = this._nodes[i]
        var newNodePos = Object.keys(newNodes)
        var newNodeCount = newNodePos.length

        // optionally reorder the new nodes to make control point assignment deterministic
        // For best results duplicate nodes should be merged, with proportionately more control points
        if (this._orderNodes) {
            var newNodesSorted = this._orderNodes(newNodePos.map(function(ix) { return newNodes[ix] }))
            for (var i = 0; i < newNodePos.length; i++) this._nodes[newNodePos[i]] = newNodesSorted[i]
        }

        // determine how many points we need and their spacing and position
        // Currently we ignore the per-node weight, and use the instance weight
        var pointCount = newNodeCount * this._weightDefault
        var step = this._range / pointCount

        // uniformly distribute control points among the new nodes
        // NOTE: the new points might overlap existing control points, not checked
        for (var i = 0; i < newNodePos.length; i++) {
            var keys = this._nodeKeys[newNodePos[i]]
            keys.length = this._weightDefault
            var offset = step * i + step / 2
            for (var j = 0; j < this._weightDefault; j++) keys[j] = Math.round(offset + (step * newNodeCount) * j)
        }

        // rebuild the control points to nodes mapping
        // TODO: do not manually rebuild the _keyMap, punt to _buildKeys that will be needed anyway
        this._keyMap = {}
        for (var i = 0; i < this._nodeKeys.length; i++) this._mapNodePoints(this._nodes[i], this._nodeKeys[i]);

        this._needKeyMap = false;
    },

    /**
     * remove all instances of the node from the hash ring
     */
    remove:
    function remove( node ) {
        var ix
        // note: indexOf() is a very fast O(n) linear search by pointer
        // loop to get duplicate entries too
        while ((ix = this._nodes.indexOf(node)) >= 0) {
            var keys = this._nodeKeys[ix]
            this._nodes[ix] = this._nodes[this._nodes.length - 1]
            this._nodes.length -= 1
            this._nodeKeys[ix] = this._nodeKeys[this._nodeKeys.length - 1]
            this._nodeKeys.length -= 1
            this._keys = null
            this._needKeyMap = true
            this._keyMap = null
            this.nodeCount -= 1
            this.keyCount -= keys.length
            ix -= 1
        }
        return this
    },

    /**
     * return the first node in the hash ring after name
     */
    get:
    function get( name, count ) {
        if (count) return this._getMany(name, count);
        if (!this.keyCount) return null
        var index = this._locate(name)
        return this._keyMap[this._keys[index]]
    },

    // return the first n distinct nodes in the hash ring after name
    _getMany:
    function _getMany( name, n ) {
        if (!this.keyCount) return null
        var index = this._locate(name)
        var node, nodes = [];
        for (var i=index; i<this.keyCount && nodes.length < n; i++) {
            node = this._keyMap[this._keys[i]];
            if (nodes.indexOf(node) < 0) nodes.push(node);
        }
        for (var i=0; i<index && nodes.length < n; i++) {
            node = this._keyMap[this._keys[i]];
            if (nodes.indexOf(node) < 0) nodes.push(node);
        }
        return nodes;
    },

    /**
     * Return the list of currently known nodes.
     */
    getNodes:
    function getNodes( ) {
        return this._nodes;
    },

    /**
     * Return the list of control points assigned to the node.
     */
    getPoints:
    function getPoints( node ) {
        if (this._needKeyMap) this._buildKeyMap(this._weightDefault);

        var ix = this._nodes.indexOf(node);
        return ix < 0 ? undefined : this._nodeKeys[ix];
    },

    // return the index of the node that handles resource name
    _locate:
    function _locate( name ) {
        if (this._needKeyMap) this._buildKeyMap(this._weightDefault);

        if (typeof name !== 'string') name = "" + name
        if (!this._keys) this._buildKeys()
        var h = this._hash(name)

        // scaling up the hash distributes better for larger _range values
        h = h << 5

        // the mod counters the lsbyte too closely tracking the input suffix
        h = h % this._range

        return this._absearch(this._keys, h)
    },

    // 24-bit PJW string hash variant, see https://en.wikipedia.org/wiki/PJW_hash_function
    // pjw seems to work better than crc24 for the test cases in the unit tests
    _hash:
    function _pjwHash(s) {
        var len = s.length
        var g, h = 0
        // TODO: speed up the hash computation for long strings
        // the hash does not have to be perfect, just well distributed
        for (var i=0; i<len; i++) {
            h = (h << 4) + s.charCodeAt(i)
            g = h & 0xff000000          // isolate high 4 bits and overflow
            // PJW grabs bits 28..31 and xors them into the high nybble bits 4-7
            // we grab bits 24-28 and xor them into the low nybble bits 0-3,
            // seems to result in a less poor distribution taken mod 2^N, N>3.
            if (g) {
                h &= ~g                 // clear high 4 bits
                h ^= (g >>> 24)         // xor high 4 bits into low byte
            }
        }
        // for well distributed input, h has a good distribution in the lsb`s
        // but for correlated input eg /a[0-9]+/ it is skewed and caller must fix
        // Taking h % prime seems to work well, esp for smallish primes (1009, 10007)
        // Conversely, taking h % 2^N (N>3) results in a very skewed distribution.
        return h
    },

/**
    // 24-bit CRC hash variant, see https://www.cs.hmc.edu/~geoff/classes/hmc.cs070.200101/homework10/hashfuncs.html
    _hash2:
    function _crcHash( s ) {
        // rotate left 5 bits, xor in each new byte
        // http://www.cs.hmc.edu/~geoff/classes/hmc.cs070.200101/homework10/hashfuncs.html
        var len = s.length
        var g, h = 0
        for (var i=0; i<len; i++) {
            // 24-bit hash
            g = h & 0xf80000
            h = (((h & ~0xf80000) << 5) | (g >>> 19)) ^ s.charCodeAt(i)
        }
        return h
    },
**/

/**
    // djb2: good string hash: http://www.cse.yorku.ca/~oz/hash.html
    //   hash(i) = hash(i - 1) * 33 ^ str[i];
    // (adapted from qpubs)
    _hash3:
    function _djb2( s ) {
        for (var h=0, len=s.length, i=0; i<len; i++) h = ((h * 33) ^ s.charCodeAt(i)) & 0xffffff;
        return h
    },
**/

    // binary search the sorted array for the location of the key
    // returns the index of the first value >= key, or 0 if key > max(array)
    _absearch:
    function _absearch( array, key ) {
        var i, j, mid, gap = 25, len = array.length
        for (i=0, j=len-1; j - i > gap; ) {
            mid = (i + j) >>> 1
            if (array[mid] < key) i = mid + 1
            else j = mid
        }
        // faster to linear search once the location is narrowed to gap items
        // this is the `approximate binary` in the `_absearch`
        for ( ; i<len; i++) if (array[i] >= key) return i
        return array.length === 0 ? -1 : 0
    },

    // regenerate the sorted keys array
    // TODO: also rebuild the _keyMap points-to-nodes lookup
    _buildKeys:
    function _buildKeys( ) {
        var i, j, nodeKeys, keys = new Array()
        for (i=0; i<this._nodeKeys.length; i++) {
            nodeKeys = this._nodeKeys[i]
            for (j=0; j<nodeKeys.length; j++) {
                keys.push(nodeKeys[j])
            }
        }
        // note: duplicate keys are not filtered out, but should work ok
        keys.sort(function(a,b){ return a - b })
        return this._keys = keys
    },

    // map the control points to point to the node
    _mapNodePoints:
    function _mapNodePoints( node, points ) {
        var len = points.length, map = this._keyMap
        for (var i = 0; i < len; i++) map[points[i]] = node
    },

/**
    // remove the array element at position ix and close the gap (adapted from qibl)
    _removeByIndex( array, ix ) {
        if (ix < 0 || ix >= array.lenth) return
        for ( ; ix < array.length - 1; ix++) array[ix] = array[ix + 1]
        array.pop()
    }
**/
}

module.exports = ConsistentHash
