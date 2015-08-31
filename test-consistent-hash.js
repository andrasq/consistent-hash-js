var ConsistentHash = require('./consistent-hash.js')

// format numbers in base 26 with digits 'a' .. 'z'
function numBase26(n) {
    var d, ret = ""
    while (n > 0) {
        d = n % 26
        ret = String.fromCharCode(0x61 + d) + ret
        n = (n / 26) >>> 0
    }
    return ret;
}

// FIXME: setUp/beforeEach should run before each same-level test!  *not* sub-tests
// hack: until setUp is fixed to run only before shared tests...
var cut = null

module.exports = {
    setUp: function(done) {
        this.cut = new ConsistentHash()
        done()
    },

    'package': {
        'should be valid json': function(t) {
            var json = require('./package.json')
            t.done()
        },

        'should export the class': function(t) {
            var index = require('./index.js')
            t.equal(index, ConsistentHash)
            t.done()
        },
    },

    'class': {
        'add should associate control points with the node': function(t) {
            this.cut.add("a")
            t.ok(this.cut._nodeKeys[0].length > 0)
            t.done()
        },

        'add should add n control points': function(t) {
            this.cut.add("a", 7)
            t.equal(this.cut._nodeKeys[0].length, 7)
            t.done()
        },

        'repeated adds should add more control points': function(t) {
            this.cut.add("a")
            this.cut.add("a", 7)
            this.cut.get("x")
            t.equal(this.cut._keys.length, 8)
            t.done()
        },

        'add should clear _keys': function(t) {
            this.cut.add("a")
            t.ok(!this.cut._keys)
            t.done()
        },

        'get should build _keys array': function(t) {
            this.cut.add("a")
            this.cut.get("a")
            t.ok(Array.isArray(this.cut._keys))
            t.done()
        },

        'get should return a node': function(t) {
            this.cut.add("n1")
            var node = this.cut.get(0)
            t.equal(node, "n1")
            t.done()
        },

        'get should return a specific node for each string': function(t) {
            this.cut.add("a")
            this.cut.add("b")
            var node1 = this.cut.get("abc")
            var node2 = this.cut.get("abc")
            t.equal(node1, node2)
            t.done()
        },

        'get should return the same node when node is added after': function(t) {
            this.cut.add("C", 1, [0x43])
            var node1 = this.cut.get("A")
            this.cut.add("F", 1, [0x46])
            var node2 = this.cut.get("A")
            t.ok(node1 == node2)
            t.done()
        },

        'get should return new node when node is added before': function(t) {
            this.cut.add("F", 1, [0x46])
            var node1 = this.cut.get("A")
            this.cut.add("C", 1, [0x43])
            var node2 = this.cut.get("A")
            t.ok(node1 != node2)
            t.done()
        },

        'get should return the same node after deleting node after': function(t) {
            this.cut.add("C", 1, [0x43])
            this.cut.add("F", 1, [0x46])
            var node1 = this.cut.get("A")
            this.cut.remove("F")
            var node2 = this.cut.get("A")
            t.ok(node1 == node2)
            t.done()
        },

        'get should reassign resource after removing node': function(t) {
            this.cut.add("C", 1, [0x43])
            this.cut.add("F", 1, [0x46])
            var node1 = this.cut.get("A")
            this.cut.remove("C")
            var node2 = this.cut.get("A")
            t.ok(node1 != node2)
            t.done()
        },

        'get should distribute items among nodes fairly uniformly': function(t) {
            var i, j, points = new Array(10)
            for (i=0; i<points.length; i++) {
                points[i] = i * this.cut._range / points.length
            }
            var node, nbins = points.length, bins = new Array(nbins)
            for (i=0; i<nbins; i++) bins[i] = 0
            for (i=0; i<nbins; i++) this.cut.add('' + i, 1, [points[i]])
            for (i=0; i<10000; i++) {
                //node = this.cut.get("a" + i)
                // note: base 10 numbers in ascii are not very uniform, and can skew the distribution
                // base 26 number expressed with with letters a-z work, as do base-32 numbers 0-9a-v
                //node = this.cut.get("abc" + numBase26(i))
                //node = this.cut.get("abc" + i.toString(16))
                node = this.cut.get('a' + i)
                bins[node] += 1
            }
//console.log("AR: bins", bins)
            for (i=0; i<nbins; i++) {
                for (j=0; j<nbins; j++) {
                    if (i === j) continue
                    t.ok(bins[i] * 10 > bins[j])
                    t.ok(bins[j] * 10 > bins[i])
                }
            }
            t.done()
        },

        'remove should unmap the node': function(t) {
            this.cut.add("a")
            t.ok(this.cut._nodeKeys[0])
            this.cut.remove("a")
            t.ok(!this.cut._nodeKeys[0])
            t.done()
        },

        'remove should clear the _keys array': function(t) {
            this.cut.add("a")
            this.cut.get("a")
            this.cut.remove("a")
            t.ok(!this.cut._nodeKeys[0])
            t.done()
        },
    },

    '_hash': {
        '_flip8Map should flip bits in byte': function(t) {
            var i, b, flip4map = [0, 8, 4, 12, 2, 10, 6, 14, 1, 9, 5, 13, 3, 11, 7, 15]
            for (i=0; i<256; i++) {
                b = (flip4map[i & 0xf] << 4) | (flip4map[(i >> 4) & 0xf])
                t.equal(this.cut._flip8Map[i], b)
            }
            t.done()
        },

        '_flip8Map should reverse position of one-bit numbers': function(t) {
            var i, bit
            for (i=0; i<8; i++) {
                bit = 1 << i
                t.ok(this.cut._flip8Map[bit] == 1 << (7 - i))
            }
            t.done()
        },

        'should compute different hashes for similar strings': function(t) {
            var h1 = this.cut._hash("a1")
            var h2 = this.cut._hash("b1")
            t.ok(h1 != h2)
            t.done()
        },

        'should distribute hashes fairly uniformly': function(t) {
            // note: 16 bins sync up with ascii [0-9] suffix and break distribution
            var h, i, bins = []
            for (i=0; i<20; i++) bins[i] = 0
            for (i=0; i<10000; i++) {
                // well-distributed input hashes great.  use 
                //h = this.cut._hash((Math.random() * 0x10000 >>> 0).toString(16))
                //h = this.cut._hash(numBase26(i))
                // non-uniform input eg /a[0-9]+/ is a better test
                h = this.cut._hash('a' + i + i + i + i)
                //h = this.cut._hash('a' + i.toString(16))
                // note: be sure to mod with a relative prime, else will not be uniform
                bins[h % bins.length] += 1
            }
            bins.sort(function(a,b){ return a - b })
//console.log("AR: _hash bins", bins.slice(0, 5), bins.slice(-5))
            // hash distribution should be within 2x across all bins
            t.ok(bins[0] * 2 >=  bins[bins.length - 1])
            t.done()
        },
    },

    '_absearch': {
        'should return -1 on empty array': function(t) {
            var ret = this.cut._absearch([], 1)
            t.equals(ret, -1)
            t.done()
        },

        'should return 0 if smaller than first in array': function(t) {
            t.equals(this.cut._absearch([10, 20], 9), 0)
            t.done()
        },

        'should return 0 if larger than last in array': function(t) {
            t.equals(this.cut._absearch([10, 20], 21), 0)
            t.done()
        },

        'should return index of smallest value not less than n': function(t) {
            t.equal(this.cut._absearch([10, 20], 9), 0)
            t.equal(this.cut._absearch([10, 20], 10), 0)
            t.equal(this.cut._absearch([10, 20], 11), 1)
            t.equal(this.cut._absearch([10, 20], 19), 1)
            t.equal(this.cut._absearch([10, 20], 20), 1)
            t.done()
        },
    },

    '_buildKeys': {
        'should assemble sorted array of the node control points': function(t) {
            this.cut._nodeKeys = [
                [ 20, 10, 30 ],
                [ 11, 21, 31 ],
                [ 12, 32, 22 ],
            ]
            this.cut._buildKeys()
            t.deepEqual(this.cut._keys, [10, 11, 12, 20, 21, 22, 30, 31, 32])
            t.done()
        },
    },

    'timings': {
        before: function(done) {
            cut = new ConsistentHash()
            this.data = new Array()
            done.done ? done.done() : done()
        },

        'generate 10k control points': function(t) {
            for (i=0; i<10000; i++) this.data[i] = Math.random() * 0x10000 >>> 0
            this.data.sort(function(a,b) { return a < b ? -1 : a > b ? 1 : 0 })
            t.done()
        },

        'add 10k nodes and prime': function(t) {
            var i, nodes = []
            for (i=0; i<this.data.length; i++) nodes.push("abc" + this.data[i].toString(16))
            for (i=0; i<this.data.length; i++) cut.add(nodes[i])
            cut.get("a")
            t.done()
        },

        'time 100k _hash': function(t) {
            for (var i=0; i<100000; i++) cut._hash("abc")
            t.done()
        },

        'time 100k _absearch': function(t) {
            var i, j
            for (j=0; j<10; j++) for (i=0; i<10000; i++) cut._absearch(this.data, this.data[i])
            t.done()
        },

        'time 100k get': function(t) {
            var i, j, node
            for (j=0; j<10; j++) for (i=0; i<10000; i++) node = cut.get(this.data[i])
            t.done()
        },
    },
}
