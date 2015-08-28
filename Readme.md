consistent-hash
===============

This is a dependency-free javascript-only implementation of consistent hashing
hash ring.  Uses strings for hash keys, and hashes using the PJW hash
algorithm.


Summary
-------

        var ConsistentHash = require('consistent-hash')
        var hr = new ConsistentHash()
        hr.add('node1')
        hr.add('node2')

        var node1 = hr.get('firstResource')
        var node2 = hr.get('secondResource')


Installation
------------

        npm install consistent-hash


API
---

### hr = new ConsistentHash( )

### hr.add( nodeName [,weight] )

Register a node as also managing the resource.

- `weight` - how many resource instances this node should manage compared to the other nodes (default 1).
Higher weights will be assigned more resources.  Three nodes A, B and C with
weights 1, 2 and 3 will each handle 1/6, 1/3 and 1/2 of the resources,
respectively.

### hr.remove( nodeName )

Remove the named node from the hash ring and deallocate its control points.

### hr.get( resourceName )

Return the node that handles the named resource.

