# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

import genlayer as gl


class SimpleStorage(gl.contract.Contract):
    value: str

    @gl.contract.write
    def set_value(self, new_value: str):
        self.value = new_value

    @gl.contract.read
    def get_value(self):
        return self.value
