package com.yunflow.memory;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

@CapacitorPlugin(name = "BackupFile")
public class BackupFilePlugin extends Plugin {
    @PluginMethod
    public void save(PluginCall call) {
        String name = call.getString("name");
        String data = call.getString("data");
        if (name == null || data == null) {
            call.reject("备份文件缺少名称或内容");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("application/json");
        intent.putExtra(Intent.EXTRA_TITLE, name);
        try {
            startActivityForResult(call, intent, "writeBackup");
        } catch (android.content.ActivityNotFoundException error) {
            call.reject("找不到系统文件选择器", error);
        }
    }

    @ActivityCallback
    private void writeBackup(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result.getResultCode() != Activity.RESULT_OK) {
            call.resolve(new JSObject().put("saved", false));
            return;
        }
        Intent intent = result.getData();
        Uri uri = intent == null ? null : intent.getData();
        String data = call.getString("data");
        if (uri == null || data == null) {
            call.reject("无法获取备份文件路径或内容");
            return;
        }
        getBridge().execute(() -> {
            try (OutputStream stream = getContext().getContentResolver().openOutputStream(uri, "wt")) {
                if (stream == null) throw new IOException("No output stream");
                stream.write(data.getBytes(StandardCharsets.UTF_8));
            } catch (IOException | SecurityException error) {
                call.reject("无法写入备份文件", error);
                return;
            }
            call.resolve(new JSObject().put("saved", true));
        });
    }
}
