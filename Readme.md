consistent-hash
===============

This is a dependency-free javascript-only implementation of
[consistent hashing](https://en.wikipedia.org/wiki/Consistent_hashing) hash
ring.  Uses strings for hash keys, and hashes using the PJW hash algorithm.

This implementation is not the fastest (though pretty fast), but has a nice key
distribution.

        var ConsistentHash = require('consistent-hash')
        var hr = new ConsistentHash()
        hr.add('node1')
        hr.add('node2')

        var node = hr.get('resourceName')


Installation
------------

        npm install consistent-hash


API
---

### hr = new ConsistentHash( options )

Options:

- `range` - hash ring control point range, default 1009.  Use a prime number.
  Smaller ranges have better key distribution, larger ranges allow more nodes.

Properties:

- `nodeCount` - number of nodes on the hash ring
- `keyCount` - number of control points (tokens) around the hash ring

### hr.add( node [,weight] [,points] )

Register a node as also managing the resource.  The node's share of the
resources will be proportionate to its weight.  The default weight is 1,
and control points are randomly created between 0 and range - 1.  Returns `hr`.

Adding the same node more than once increases its weight.

- `weight` - how many resource instances this node should manage compared to the other nodes (default 1).
  Higher weights will be assigned more resources.  Three nodes A, B and C with
  weights 1, 2 and 3 will each handle 1/6, 1/3 and 1/2 of the resources, respectively.
- `points` - the control points to use for this node.

### hr.remove( node )

Remove all instances of this node from the hash ring and free its control
points.  Freed control points may get allocated to newly added nodes.
Returns `hr`.

### hr.get( resourceName )

Locate the node that handles the named resource.  Returns a node previously
added with `add()`, or `null` if no nodes.


Related Work
------------

- [hashring](https://npmjs.org/package/hashring) - fast C++ hashring with poor key distribution

