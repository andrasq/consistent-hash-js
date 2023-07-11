consistent-hash
===============
[![Build Status](https://github.com/andrasq/node-consistent-hash-js/actions/workflows/nodejs.yml/badge.svg)](https://github.com/andrasq/node-consistent-hash-js/actions/workflows/nodejs.yml)
<!--
[![Coverage Status](https://coveralls.io/repos/github/andrasq/node-consistent-hash-js/badge.svg?branch=master)](https://coveralls.io/github/andrasq/node-consistent-hash-js?branch=master)
-->

This is a dependency-free javascript-only implementation of
[consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) hash
ring.  Uses strings for hash keys, and hashes using a PJW hash variant.

This implementation is pretty fast, and has a nice key distribution.

        var ConsistentHash = require('consistent-hash')
        var hr = new ConsistentHash()
        hr.add('server1')
        hr.add('server2')

        var serverToUse = hr.get('resourceName')


Installation
------------

        npm install consistent-hash


API
---

### hr = new ConsistentHash( options )

Options:

- `range` - hash ring control point modulo range, default 100003.
- `weight` - the default number of control points to create for each node added, default 40.
- `distribution` - node arrangement around the ring, for when no control points provided.
  One of `"random"` or `"uniform"`, default "random". 

The number of nodes supported is `range / weight`, default 2500.  For
10x more nodes, use a wider range like 1,000,003 or a smaller weight like 4.

Properties:

- `nodeCount` - number of nodes on the hash ring
- `keyCount` - number of control points (tokens) around the hash ring

### hr.add( node [,weight] [,points] )

Register a node as also managing the resource.  The node's share of the
resources will be proportionate to its weight.  The default weight is 40,
and control points are randomly created between 0 and range - 1.  Returns `hr`.

Adding the same node more than once increases its weight.

- `weight` - how many resource instances this node should manage compared to the other nodes (default 1).
  Higher weights will be assigned more resources.  Three nodes A, B and C with
  weights 1, 2 and 3 will each handle 1/6, 1/3 and 1/2 of the resources, respectively.
- `points` - the array of control points to use for this node.

### hr.remove( node )

Remove all instances of this node from the hash ring and free its control
points.  Freed control points may get allocated to newly added nodes.
Returns `hr`.

### hr.get( resourceName [,count] )

Locate the node that handles the named resource.  Returns a node previously
added with `add()`, or `null` if no nodes.

If a `count` is specified, it returns an array of `count` distinct nodes;
first the one that handles the named resource, then the following closest
nodes around the hash ring.


Todo
----

- way to un-remove a node, ie add it back with its old control points
- option to pass in the hash function to use
- option to sort the new nodes before assigning control points


Changelog
---------

- 1.1.1 - do not access unset _keyMap
- 1.1.0 - `options.distribution`, fix multi-node get() that wraps around 0
- 1.0.2 - 2016 version


Related Work
------------

- [hashring](https://npmjs.org/package/hashring) - fast C++ hashring with poor key distribution and slow O(n^2) setup

