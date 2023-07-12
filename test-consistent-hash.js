/**
 * Copyright (C) 2015-2016,2021,2023 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

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
            var index = require('./')
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
            t.equal(this.cut._keys.length, this.cut._weightDefault + 7)
            t.done()
        },

        'add should clear _keys': function(t) {
            this.cut.add("a")
            t.ok(!this.cut._keys)
            t.done()
        },

        'add should create n control points': function(t) {
            this.cut.add('a')
            this.cut.add('b', 4)
            this.cut.get('foo');
            t.equal(this.cut.getPoints('a').length, this.cut._weightDefault);
            t.equal(this.cut.getPoints('b').length, 4);
            t.done();
        },

        'add should create n uniformly distributed control points': function(t) {
            var hr = new ConsistentHash({ distribution: 'uniform' });
            hr.add('a')
            hr.add('b', 4)
            hr.get('foo');
            t.equal(hr.getPoints('a').length, hr._weightDefault);
            // uniform distribution ignores the requested weight, and uses the default
            t.equal(hr.getPoints('b').length, hr._weightDefault);
            t.done();
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

        'get should return count distinct nodes': function(t) {
            this.cut.add("a", 1, [10])
            this.cut.add("b", 1, [7, 20, 30])
            t.stub(this.cut, '_absearch').returns(2)
            t.deepEqual(this.cut.get("test", 3), ["b", "a"])

            this.cut.add("c", 1, [15])
            t.deepEqual(this.cut.get("test", 3), ["c", "b", "a"])
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
            t.ok(!this.cut.get("a"))
            t.done()
        },

        'remove should be idempotent': function(t) {
            this.cut.add('node-a');
            this.cut.add('node-a');
            this.cut.add('node-b');
            this.cut.get('resourceName');
            for (var i = 0; i < 2; i++) {
                this.cut.remove('node-a');
                t.equal(this.cut._nodes.length, 1);
                t.equal(this.cut._nodes[0], 'node-b');
            }
            t.done();
        },

        'getNodes should return the nodes': function(t) {
            this.cut.add('a');
            this.cut.add('b');
            this.cut.add('a');
            t.deepEqual(this.cut.getNodes(), ['a', 'b', 'a']);
            t.done();
        },

        'getPoints should return the control points of the node': function(t) {
            var hr = new ConsistentHash({ distribution: 'uniform' });
            hr.add('a');
            t.ok(!hr._keyMap['a']);
            t.equal(hr.getPoints('a').length, hr._weightDefault);
            t.equal(hr._keyMap[hr.getPoints('a')[0]], 'a');
            t.strictEqual(hr.getPoints('nonesuch'), undefined);
            t.done();
        },

        'two uniform-distribution hash rings with same node order should return same mappings': function(t) {
            var hr1 = new ConsistentHash({ distribution: 'uniform' });
            var hr2 = new ConsistentHash({ distribution: 'uniform' });
            for (var i = 0; i < 10; i++) hr1.add('node-' + i);
            for (var i = 0; i < 10; i++) hr2.add('node-' + i);
            // for (var i = 0; i < 10; i++) hr2.add('node-' + (10 - 1 - i)); // fails: different node order
            t.equal(hr1.get('foo'), hr2.get('foo'));
            t.done();
        },

        'edge cases': {
            'throws if unable to make control points': function(t) {
                var uut = new ConsistentHash({ range: 10 })
                t.throws(function() { uut.add('node1', 11) }, /unable to .* control point/)
                t.done()
            },

            'get returns null if no nodes': function(t) {
                var uut = new ConsistentHash()
                t.strictEqual(uut.get('foo'), null)
                t.done()
            },

            'get with count returns null if no nodes': function(t) {
                var uut = new ConsistentHash()
                t.strictEqual(uut.get('foo', 3), null)
                t.done()
            },
        },
    },

    '_hash': {
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

    '_buildKeyMap': {
        'should distribute points uniformly': function(t) {
            var uut = new ConsistentHash({ range: 24, weight: 4, distribution: 'uniform' })
            uut.add('node1')
            uut.add('node2')
            uut.add('node3')
            uut.get('foo')
            t.deepEqual(uut._nodes, ['node1', 'node2', 'node3'])
            t.deepEqual(uut._nodeKeys, [[1, 7, 13, 19], [3, 9, 15, 21], [5, 11, 17, 23]])
            t.deepEqual(uut._keys, [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21, 23])
            t.done()
        },

        'should distribute lookups uniformly': function(t) {
            var uut = new ConsistentHash({ distribution: 'uniform' })
            uut.add('node1')
            uut.add('node2')
            uut.add('node3')
            uut.get('foo')
            t.skip()
        },

        'should rebuild map after remove': function(t) {
            var uut = new ConsistentHash({ range: 24, weight: 4, distribution: 'uniform' })
            uut.add('node1')
            uut.add('node2')
            uut.add('node3')
            uut.get('foo')
            t.equal(Object.keys(uut._keyMap).length, 12, '3-node map has 12 keys')
            var map1 = uut._keyMap
            var node2points = uut.getPoints('node2');
            uut.remove('node2')
            // the _keyMap should be updated with node2 gone
            for (var point in uut._keyMap) {
                var node = uut._keyMap[point];
                t.ok(node === 'node1' || node === 'node3' || node === undefined);
            }
            // rebuild the points map from scratch, then map should completely omit node2
            uut._needKeyMap = true;
            uut.get('foo')
            t.equal(Object.keys(uut._keyMap).length, 8, 'rebuilt map has 8 keys')
            t.contains(map1, uut._keyMap)
            for (var k in uut._keyMap) t.notEqual(uut._keyMap[k], 'node2', 'node2 was deleted')
            t.done()
        },

        'should assign uniformly distributed points in node-add order': function(t) {
            var hr = new ConsistentHash({ distribution: 'uniform', weight: 100 });
            hr.add('a');
            hr.add('b');
            hr.get('foo');
            t.deepEqual(hr.getNodes(), ['a', 'b']);

            // points assigned in node order
            t.ok(hr.getPoints('a')[0] < hr.getPoints('b')[0]);

            // points distributed so no two points have the same node adjacent
            // _keys are already in sorted numeric order
            var allPoints = hr._keys;
            for (var i = 1; i < allPoints.length; i++) t.notEqual(hr._keyMap[allPoints[i]], hr._keyMap[allPoints[i - 1]]);
            t.done();
        },

        'should optionally assign points in sorted order': function(t) {
            var hr = new ConsistentHash({
                distribution: 'uniform', weight: 4,
                orderNodes: function(nodes) { return nodes.sort() } });
            hr.add('c');
            hr.add('b');
            hr.add('a');
            hr.get('foo');
            t.deepEqual(hr.getNodes(), ['a', 'b', 'c']);
            t.ok(hr.getPoints('a')[0] < hr.getPoints('b')[0]);
            t.ok(hr.getPoints('a')[1] < hr.getPoints('b')[1]);
            t.ok(hr.getPoints('b')[0] < hr.getPoints('c')[0]);
            t.ok(hr.getPoints('b')[1] < hr.getPoints('c')[1]);
            t.done();
        },
    },

    'timings': {
        before: function(done) {
            cut = new ConsistentHash({ range: 1000003 })
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
            // 600k/s
        },

        'time 100k _hash': function(t) {
            for (var i=0; i<100000; i++) cut._hash("abc")
            t.done()
            // 36m/s
        },

        'time 100k _absearch': function(t) {
            var i, j
            for (j=0; j<10; j++) for (i=0; i<this.data.length; i++) cut._absearch(this.data, this.data[i])
            t.done()
            // 10m/s
        },

        'time 100k get': function(t) {
            var i, j, node
            for (j=0; j<10; j++) for (i=0; i<this.data.length; i++) node = cut.get(this.data[i])
            t.done()
            // 3m/s
        },
    },
}
