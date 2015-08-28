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

module.exports = {
    setUp: function(done) {
        this.cut = new ConsistentHash()
        done()
    },

    'class': {
        'add should associate control points with the node': function(t) {
            this.cut.add("a")
            t.ok(this.cut._nodeKeys.a.length > 0)
            t.done()
        },

        'add should add n control points': function(t) {
            this.cut.add("a", 7)
            t.equal(this.cut._nodeKeys.a.length, 7)
            t.done()
        },

        'repeated adds should add more control points': function(t) {
            this.cut.add("a")
            this.cut.add("a", 7)
            t.equal(this.cut._nodeKeys.a.length, 8)
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

        'get should return a specific node for each string': function(t) {
            this.cut.add("a")
            var node1 = this.cut.get("abc")
            var node2 = this.cut.get("abc")
            t.equal(node1, node2)
            t.done()
        },

        'get should distribute items among nodes fairly uniformly': function(t) {
            var i, j, points = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]
//points = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
points = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]
            for (i=0; i<points.length; i++) points[i] *= 0x100000
            var node, nbins = points.length, bins = new Array(nbins)
            for (i=0; i<nbins; i++) bins[i] = 0
            for (i=0; i<nbins; i++) this.cut.add('' + i, 1, [points[i]])
            for (i=0; i<10000; i++) {
                //node = this.cut.get("a" + i)
                // note: base 10 numbers in ascii are not uniform enough, and skew the distribution
                // base 26 number expressed with with letters a-z work, as do base-32 numbers 0-9a-v
                //node = this.cut.get("abc" + numBase26(i))
                node = this.cut.get('a' + i)
                bins[node] += 1
            }
console.log("AR: bins", bins)
            for (i=0; i<nbins; i++) {
                for (j=0; j<nbins; j++) {
                    if (i === j) continue
                    t.ok(bins[i] * 2 > bins[j])
                    t.ok(bins[j] * 2 > bins[i])
                }
            }
            t.done()
        },

        'remove should unmap the node': function(t) {
            this.cut.add("a")
            t.ok(this.cut._nodeKeys.a)
            this.cut.remove("a")
            t.ok(!this.cut._nodeKeys.a)
            t.done()
        },

        'remove should clear the _keys array': function(t) {
            this.cut.add("a")
            this.cut.get("a")
            this.cut.remove("a")
            t.ok(!this.cut._nodeKeys.a)
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
            var h, i, bins = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
            for (i=0; i<10000; i++) {
                // well-distributed input hashes great
                //h = this.cut._hash((Math.random() * 0x10000 >>> 0).toString(32))
                //h = this.cut._hash(numBase26(i))
                // non-uniform input eg /a[0-9]+/ is a better test
                h = this.cut._hash('a' + i)
                bins[h % bins.length] += 1
            }
            // check that all bins are close to all other bins
            for (i=0; i<bins.length; i++) {
                for (j=0; j<bins.length; j++) {
                    if (i === j) continue
                    t.ok(bins[i] * 2 >= bins[j])
                    t.ok(bins[j] * 2 >= bins[i])
                }
            }
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
            this.cut._nodeKeys = {
                a: [ 20, 10, 30 ],
                b: [ 11, 21, 31 ],
                c: [ 12, 32, 22 ],
            }
            this.cut._buildKeys()
            t.deepEqual(this.cut._keys, [10, 11, 12, 20, 21, 22, 30, 31, 32])
            t.done()
        },
    },

    'timings': {
        before: function(done) {
            this.data = new Array()
            done()
        },

        'generate 10k control points': function(t) {
            for (var i=0; i<10000; i++) this.data.push("abc" + (Math.random() * 0x10000 >>> 0).toString(16))
            this.data.sort(function(a,b) { return a < b ? -1 : a > b ? 1 : 0 })
            var i
            for (i=0; i<this.data.length; i++) this.cut.add(this.data[i])
            t.done()
        },

        'time 100k _hash': function(t) {
            for (var i=0; i<100000; i++) this.cut._hash("abc")
            t.done()
        },

        'time 100k _absearch': function(t) {
            var i, j
            for (j=0; j<10; j++) for (i=0; i<10000; i++) this.cut._absearch(this.data, this.data[i])
            t.done()
        },

        'time 100k get': function(t) {
            var i, j, node
            for (j=0; j<10; j++) for (i=0; i<10000; i++) node = this.cut.get(this.data[i])
            t.done()
        },
    },
}
