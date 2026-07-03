from sympy import *
A = MatrixSymbol('A', 2, 2)
print("A is_square:", A.is_square)
invA = A**-1
print("invA is_square:", invA.is_square)
print("invA shape:", invA.shape)
