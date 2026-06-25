from sympy import *
A = MatrixSymbol('A', 2, 2)
print("A**-1:", A**-1)
print("type(A**-1):", type(A**-1))
print("is_square(A**-1):", (A**-1).is_square)
