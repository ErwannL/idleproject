package com.ascendrya.app;

import android.content.pm.ActivityInfo;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    // v10.8 (partie 7) : le téléphone reste en vertical (le jeu se joue d'une main, le combat reste visible avec un menu
    // ouvert) ; une tablette (petit côté de 600 dp ou plus) peut tourner.
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (getResources().getConfiguration().smallestScreenWidthDp < 600) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_USER_PORTRAIT);
        }
    }
}
